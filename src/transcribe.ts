/**
 * Transcription côté serveur, optionnelle.
 * S'appuie sur un point d'accès compatible « audio/transcriptions » (format Whisper),
 * qu'il s'agisse d'un service en ligne ou d'un serveur Whisper local.
 * Sans configuration, l'application utilise la reconnaissance vocale du navigateur.
 */
export const TRANSCRIPTION_URL = process.env.TRANSCRIPTION_API_URL?.trim() || "";
const TRANSCRIPTION_KEY = process.env.TRANSCRIPTION_API_KEY?.trim() || "";
const TRANSCRIPTION_MODEL = process.env.TRANSCRIPTION_MODEL?.trim() || "whisper-1";

export const serverTranscriptionEnabled = TRANSCRIPTION_URL.length > 0;

export class TranscriptionError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function transcribeAudio(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  if (!serverTranscriptionEnabled) {
    throw new TranscriptionError("La transcription côté serveur n'est pas configurée (TRANSCRIPTION_API_URL).", 501);
  }

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType || "audio/webm" }), filename || "consultation.webm");
  form.append("model", TRANSCRIPTION_MODEL);
  form.append("language", "fr");
  form.append("response_format", "json");

  const headers: Record<string, string> = {};
  if (TRANSCRIPTION_KEY) headers.Authorization = `Bearer ${TRANSCRIPTION_KEY}`;

  let res: Response;
  try {
    res = await fetch(TRANSCRIPTION_URL, { method: "POST", headers, body: form });
  } catch {
    throw new TranscriptionError("Service de transcription injoignable.", 503);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new TranscriptionError(`Service de transcription : erreur ${res.status}. ${body.slice(0, 300)}`, 502);
  }
  const data = (await res.json()) as { text?: unknown };
  if (typeof data.text !== "string") {
    throw new TranscriptionError("Réponse du service de transcription inexploitable.", 502);
  }
  return data.text.trim();
}
