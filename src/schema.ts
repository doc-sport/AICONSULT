import { z } from "zod";

/**
 * Structure du compte rendu de consultation.
 * Chaque champ texte contient « Non abordé » lorsque l'élément n'a pas été évoqué
 * pendant la consultation : le modèle n'invente jamais d'information.
 */
export const CompteRenduSchema = z.object({
  presentation: z
    .string()
    .describe(
      "Présentation succincte et non identifiante du patient : sexe, âge, profil (ex. « Homme de 34 ans, coureur amateur »). Jamais de nom.",
    ),
  motif_consultation: z.string().describe("Motif de consultation, en une à trois phrases."),
  antecedents_personnels: z
    .string()
    .describe(
      "Antécédents personnels médicaux, chirurgicaux et traumatiques, traitements en cours, allergies.",
    ),
  facteurs_risque_cardiovasculaire: z
    .string()
    .describe(
      "Facteurs de risque cardiovasculaire évoqués (tabac, HTA, diabète, dyslipidémie, surpoids, sédentarité, hérédité coronarienne, âge…) et ceux explicitement absents.",
    ),
  antecedents_familiaux: z
    .string()
    .describe("Antécédents familiaux, notamment cardiovasculaires et de mort subite."),
  mode_de_vie: z.object({
    travail_scolarite: z
      .string()
      .describe("Activité professionnelle ou scolarité, contraintes physiques et horaires."),
    pratique_sportive: z.object({
      passe_sportif: z
        .string()
        .describe("Passé sportif : disciplines, niveau, volume, âge de début et d'arrêt."),
      pratique_actuelle: z
        .string()
        .describe(
          "Pratique actuelle telle qu'elle est réalisée ou a été réalisée récemment : discipline, fréquence, volume hebdomadaire, intensité, compétition, objectifs.",
        ),
    }),
    autres: z
      .string()
      .describe("Autres éléments du mode de vie : tabac, alcool, sommeil, alimentation, etc."),
  }),
  histoire_maladie: z
    .string()
    .describe(
      "Histoire de la maladie, détaillée et chronologique : circonstances de survenue, mécanisme, date, évolution, symptômes associés, traitements déjà essayés, retentissement sur la pratique et le quotidien.",
    ),
  examen_clinique: z.object({
    examen: z
      .string()
      .describe(
        "Examen clinique : constantes et mesures (poids, taille, TA, FC…), inspection, palpation, mobilités, tests spécifiques, examen général, organisé par appareil ou région.",
      ),
    electrocardiogramme: z
      .string()
      .describe(
        "Électrocardiogramme : description telle que dictée par le médecin. « Non réalisé » s'il n'a pas été fait.",
      ),
  }),
  conclusion: z.object({
    diagnostics: z
      .array(z.string())
      .describe("Diagnostic retenu ou diagnostics suspectés, du plus probable au moins probable."),
    conduite_a_tenir: z.object({
      imagerie: z.string().describe("Examens d'imagerie prescrits (radiographie, échographie, IRM, scanner…)."),
      kinesitherapie: z.string().describe("Prescription de kinésithérapie : nombre de séances, objectifs, techniques."),
      medicaments: z.string().describe("Traitements médicamenteux prescrits : molécule, posologie, durée."),
      autres_prescriptions: z
        .string()
        .describe("Autres prescriptions : biologie, avis spécialisé, orthèses, semelles, certificats, arrêt de travail…"),
      recommandations_pratique_sportive: z
        .string()
        .describe(
          "Recommandations concernant la pratique sportive : arrêt, adaptation, reprise progressive, activités autorisées et interdites, délais.",
        ),
      autoreeducation: z
        .string()
        .describe("Auto-rééducation et exercices à réaliser par le patient : exercices, fréquence, progression."),
      suivi: z.string().describe("Modalités de suivi : prochaine consultation, critères de réévaluation, signes devant faire reconsulter."),
    }),
  }),
  points_a_verifier: z
    .array(z.string())
    .describe(
      "Points que le médecin devrait vérifier ou compléter : passages ambigus de la transcription, éléments habituellement attendus mais non abordés, incohérences.",
    ),
});

export type CompteRendu = z.infer<typeof CompteRenduSchema>;

/** Entrée de la génération : transcription brute et notes complémentaires du médecin. */
export const ReportRequestSchema = z.object({
  transcript: z.string().trim().min(20, "La transcription est trop courte pour produire un compte rendu."),
  notes: z.string().trim().max(20000).default(""),
  contexte: z.string().trim().max(500).default(""),
});

export type ReportRequest = z.infer<typeof ReportRequestSchema>;
