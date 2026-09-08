import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { EFFORT, MODEL, MOCK_MODE, ReportError, generateReport } from "./report.js";
import { ReportRequestSchema } from "./schema.js";
import { TranscriptionError, serverTranscriptionEnabled, transcribeAudio } from "./transcribe.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, "..", "public");

const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? 3000);

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "5mb" }));
// Aucune donnée de consultation n'est journalisée ni stockée côté serveur.
app.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.get("/api/config", (_req, res) => {
  res.json({
    model: MOCK_MODE ? "démonstration (aucun appel à Claude)" : MODEL,
    effort: EFFORT,
    mock: MOCK_MODE,
    serverTranscription: serverTranscriptionEnabled,
  });
});

app.post("/api/report", async (req, res) => {
  let input;
  try {
    input = ReportRequestSchema.parse(req.body);
  } catch (error) {
    const message = error instanceof ZodError ? error.issues.map((i) => i.message).join(" ") : "Requête invalide.";
    res.status(400).json({ error: message });
    return;
  }
  try {
    const result = await generateReport(input);
    res.json(result);
  } catch (error) {
    if (error instanceof ReportError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("Erreur inattendue lors de la génération du compte rendu :", error);
    res.status(500).json({ error: "Erreur interne lors de la génération du compte rendu." });
  }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Aucun fichier audio reçu." });
    return;
  }
  try {
    const text = await transcribeAudio(req.file.buffer, req.file.mimetype, req.file.originalname);
    res.json({ text });
  } catch (error) {
    if (error instanceof TranscriptionError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("Erreur inattendue lors de la transcription :", error);
    res.status(500).json({ error: "Erreur interne lors de la transcription." });
  }
});

app.use(express.static(publicDir));

app.listen(PORT, HOST, () => {
  console.log(`AIConsult disponible sur http://${HOST}:${PORT}`);
  console.log(`Modèle : ${MOCK_MODE ? "mode démonstration" : `${MODEL} (effort ${EFFORT})`}`);
  console.log(
    `Transcription : ${serverTranscriptionEnabled ? "serveur + navigateur" : "reconnaissance vocale du navigateur"}`,
  );
  if (!MOCK_MODE && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.warn("Attention : ANTHROPIC_API_KEY n'est pas définie. La génération du compte rendu échouera.");
  }
});
