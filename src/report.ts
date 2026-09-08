import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { CompteRenduSchema, type CompteRendu, type ReportRequest } from "./schema.js";
import { MOCK_REPORT } from "./mock.js";

export const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5";

const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
type Effort = (typeof EFFORTS)[number];
const envEffort = process.env.CLAUDE_EFFORT;
export const EFFORT: Effort = EFFORTS.includes(envEffort as Effort) ? (envEffort as Effort) : "high";

export const MOCK_MODE = process.env.AICONSULT_MOCK === "1";

const SYSTEM_PROMPT = `Tu es l'assistant de rédaction d'un médecin (médecine du sport et médecine générale). À partir de la transcription d'une consultation, tu rédiges le compte rendu médical structuré que le médecin relira et signera.

Règles de rédaction :
- N'utilise que les informations présentes dans la transcription et les notes complémentaires. N'invente jamais un antécédent, une mesure, un résultat, un diagnostic ou une prescription. Si un élément n'a pas été évoqué, écris « Non abordé » (ou « Non réalisé » pour l'ECG).
- La transcription est une reconnaissance vocale automatique : elle peut contenir des erreurs de mots, des homophones, des termes médicaux mal transcrits et des passages sans ponctuation. Corrige silencieusement ce qui est évident (ex. « le terme homophone d'un terme médical »), et signale dans « points_a_verifier » ce qui reste ambigu.
- La consultation est un dialogue entre le médecin et le patient (parfois un accompagnant). Distingue ce que rapporte le patient (« rapporte », « décrit », « signale ») de ce que constate le médecin à l'examen.
- Registre médical : phrases sobres, précises, à la troisième personne (« le patient » / « la patiente »), vocabulaire médical courant, abréviations usuelles uniquement (TA, FC, IMC, ECG, IRM…). Pas de formule de politesse, pas de commentaire.
- L'« histoire de la maladie » est la section la plus détaillée : chronologie, circonstances et mécanisme de survenue, évolution, signes associés, facteurs déclenchants et soulageants, traitements déjà entrepris, retentissement sur l'activité sportive, professionnelle et quotidienne.
- La « pratique sportive » sépare le passé sportif de la pratique actuelle ou récente (discipline, fréquence, volume, intensité, niveau, compétition, objectifs).
- Dans la conclusion, liste les diagnostics retenus ou suspectés, puis détaille la conduite à tenir par rubrique. Les recommandations sportives précisent ce qui est autorisé, ce qui est à éviter et les délais ou critères de reprise.
- « points_a_verifier » : quelques points concrets et utiles (passage inaudible ou ambigu, information attendue mais absente, incohérence entre deux passages, posologie à confirmer). Pas de conseils génériques.

Confidentialité : le compte rendu ne doit contenir aucune donnée directement identifiante. Si la transcription contient malgré tout un nom, un prénom, une date de naissance complète, une adresse, un numéro de téléphone ou un employeur nommément désigné, omets-les et remplace-les par une formulation neutre (« le patient », « son employeur », « né en [année] » sans le jour ni le mois). Ne les recopie jamais.

Rédige en français.`;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export class ReportError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function buildUserMessage(req: ReportRequest): string {
  const parts: string[] = [];
  if (req.contexte) parts.push(`<contexte>\n${req.contexte}\n</contexte>`);
  parts.push(`<transcription>\n${req.transcript}\n</transcription>`);
  parts.push(
    `<notes_complementaires>\n${req.notes || "(aucune)"}\n</notes_complementaires>`,
  );
  parts.push("Rédige le compte rendu structuré de cette consultation.");
  return parts.join("\n\n");
}

export interface ReportResult {
  report: CompteRendu;
  model: string;
  usage?: { input_tokens: number; output_tokens: number };
}

export async function generateReport(req: ReportRequest): Promise<ReportResult> {
  if (MOCK_MODE) {
    await new Promise((r) => setTimeout(r, 800));
    return { report: MOCK_REPORT, model: "mock" };
  }

  let response;
  try {
    response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildUserMessage(req) }],
      output_config: { effort: EFFORT, format: zodOutputFormat(CompteRenduSchema) },
      // Repli serveur : si le modèle décline la demande pour raison de politique,
      // la requête est rejouée sur le modèle de secours recommandé par Anthropic.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new ReportError(
        "Clé API Anthropic absente ou invalide. Renseignez ANTHROPIC_API_KEY dans le fichier .env.",
        500,
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new ReportError("Limite de débit atteinte auprès de l'API. Réessayez dans quelques instants.", 503);
    }
    if (error instanceof Anthropic.BadRequestError) {
      throw new ReportError(`Requête refusée par l'API : ${error.message}`, 500);
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new ReportError("Impossible de joindre l'API Anthropic. Vérifiez la connexion réseau.", 503);
    }
    if (error instanceof Anthropic.APIError) {
      throw new ReportError(`Erreur de l'API Anthropic (${error.status}) : ${error.message}`, 502);
    }
    throw error;
  }

  if (response.stop_reason === "refusal") {
    const detail = response.stop_details?.explanation ? ` (${response.stop_details.explanation})` : "";
    throw new ReportError(`Le modèle a refusé de traiter cette transcription${detail}.`, 422);
  }
  if (response.stop_reason === "max_tokens") {
    throw new ReportError("Le compte rendu a été tronqué (limite de longueur atteinte). Réessayez.", 502);
  }
  if (!response.parsed_output) {
    throw new ReportError("Réponse du modèle inexploitable (structure invalide). Réessayez.", 502);
  }

  return {
    report: response.parsed_output,
    model: response.model,
    usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
  };
}
