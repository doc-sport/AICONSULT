import { test } from "node:test";
import assert from "node:assert/strict";
import { CompteRenduSchema, ReportRequestSchema } from "../src/schema.js";
import { MOCK_REPORT } from "../src/mock.js";

test("le compte rendu de démonstration respecte le schéma", () => {
  const parsed = CompteRenduSchema.parse(MOCK_REPORT);
  assert.equal(parsed.conclusion.diagnostics.length, 1);
  assert.ok(parsed.mode_de_vie.pratique_sportive.pratique_actuelle.length > 0);
});

test("une transcription trop courte est refusée", () => {
  assert.throws(() => ReportRequestSchema.parse({ transcript: "court" }));
});

test("les notes et le contexte sont facultatifs", () => {
  const parsed = ReportRequestSchema.parse({ transcript: "Une transcription suffisamment longue pour être acceptée." });
  assert.equal(parsed.notes, "");
  assert.equal(parsed.contexte, "");
});
