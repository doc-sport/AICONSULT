import type { CompteRendu } from "./schema.js";

/** Compte rendu fictif renvoyé en mode démonstration (AICONSULT_MOCK=1). */
export const MOCK_REPORT: CompteRendu = {
  presentation: "Homme de 34 ans, coureur amateur.",
  motif_consultation:
    "Douleur de la face antérieure du genou droit apparue depuis trois semaines à la course à pied, motivant une consultation de médecine du sport.",
  antecedents_personnels:
    "Entorse de la cheville droite en 2019, traitée fonctionnellement. Pas de chirurgie. Pas de traitement en cours. Pas d'allergie connue.",
  facteurs_risque_cardiovasculaire:
    "Aucun facteur de risque cardiovasculaire rapporté : non-fumeur, pas d'HTA, pas de diabète ni de dyslipidémie connus.",
  antecedents_familiaux: "Père hypertendu. Pas d'antécédent familial de mort subite ni de cardiopathie précoce.",
  mode_de_vie: {
    travail_scolarite: "Ingénieur, travail sédentaire sur écran, environ 9 heures par jour.",
    pratique_sportive: {
      passe_sportif: "Football en club de 8 à 18 ans, niveau départemental. Arrêt à l'entrée dans les études supérieures.",
      pratique_actuelle:
        "Course à pied depuis deux ans, trois sorties par semaine pour un volume de 30 à 35 km. Augmentation récente du volume en préparation d'un semi-marathon prévu dans deux mois.",
    },
    autres: "Sommeil satisfaisant. Consommation d'alcool occasionnelle. Non-fumeur.",
  },
  histoire_maladie:
    "Le patient rapporte l'apparition progressive, il y a trois semaines, d'une douleur antérieure du genou droit, sans traumatisme. La douleur est survenue après une augmentation rapide du volume hebdomadaire de course (passage de 25 à 35 km en deux semaines) avec introduction de séances en côte. Elle apparaît après 20 à 30 minutes de course, s'accentue en descente et à la descente des escaliers, et persiste quelques heures après l'effort. Sensation d'accrochage sans blocage vrai ni instabilité. Pas d'épanchement constaté par le patient. Le patient a réduit sa pratique sans arrêt complet et a pris du paracétamol de façon ponctuelle avec une efficacité partielle. Pas de retentissement professionnel.",
  examen_clinique: {
    examen:
      "Poids 74 kg, taille 178 cm, IMC 23,4. TA 126/78 mmHg, FC 58/min. Genou droit : pas d'épanchement, pas de flessum, mobilités complètes et indolores. Douleur à la palpation des facettes rotuliennes et à la compression fémoro-patellaire. Signe du rabot positif. Testing ligamentaire normal. Pas de signe méniscal. Rétraction du quadriceps et des ischio-jambiers, faiblesse relative des moyens fessiers avec valgus dynamique au squat unipodal. Cheville et hanche indolores.",
    electrocardiogramme:
      "ECG 12 dérivations de repos : rythme sinusal régulier à 58/min, PR 160 ms, QRS fins, axe normal, repolarisation sans anomalie. ECG normal.",
  },
  conclusion: {
    diagnostics: [
      "Syndrome fémoro-patellaire du genou droit, favorisé par une augmentation trop rapide de la charge d'entraînement et un déficit de contrôle du valgus dynamique.",
    ],
    conduite_a_tenir: {
      imagerie: "Pas d'imagerie en première intention. Radiographies du genou (face, profil, défilé fémoro-patellaire) en cas de persistance à six semaines.",
      kinesitherapie:
        "Dix séances de kinésithérapie : renforcement du quadriceps et des moyens fessiers, travail du contrôle du valgus dynamique, étirements de la chaîne postérieure, réathlétisation à la course.",
      medicaments: "Paracétamol 1 g, jusqu'à trois fois par jour si douleur, pendant une semaine maximum. Pas d'AINS.",
      autres_prescriptions: "Non abordé",
      recommandations_pratique_sportive:
        "Réduction du volume de course de moitié pendant trois semaines, suppression des séances en côte et en descente, sur terrain plat et souple. Vélo et natation autorisés sans restriction. Reprise progressive ensuite avec augmentation du volume de 10 % par semaine au maximum. Le semi-marathon est à reconsidérer selon l'évolution.",
      autoreeducation:
        "Quotidiennement : squats unipodaux contrôlés devant un miroir (3 séries de 10), pont fessier (3 séries de 15), étirements des quadriceps et des ischio-jambiers (30 secondes, 3 fois). Glaçage 15 minutes après l'effort si douleur.",
      suivi: "Réévaluation dans six semaines, plus tôt en cas d'épanchement, de blocage ou d'aggravation.",
    },
  },
  points_a_verifier: [
    "Le côté de l'entorse de cheville de 2019 a été transcrit de façon incertaine (« droite » puis « gauche ») : à confirmer.",
    "La posologie de kinésithérapie (« dix » ou « six » séances) est peu audible dans la transcription.",
    "Le passé sportif ne mentionne pas d'antécédent traumatique du genou : à confirmer avec le patient.",
  ],
};
