# AIConsult — assistant de consultation médicale

Application web locale qui **enregistre une consultation**, la **transcrit** et en produit un **compte rendu médical structuré** rédigé par Claude, que le médecin relit, corrige, copie, télécharge ou imprime.

## Structure du compte rendu

1. Présentation (sexe, âge, profil — jamais de nom)
2. Motif de consultation
3. Antécédents personnels
4. Facteurs de risque cardiovasculaire
5. Antécédents familiaux
6. Mode de vie : travail / scolarité, pratique sportive (passé sportif **et** pratique actuelle ou récente), autres
7. Histoire de la maladie (section détaillée : survenue, mécanisme, évolution, retentissement)
8. Examen clinique, avec rubrique électrocardiogramme
9. Conclusion : diagnostic(s) retenu(s) ou suspecté(s)
10. Conduite à tenir : imagerie, kinésithérapie, médicaments, autres prescriptions, recommandations de pratique sportive, auto-rééducation, suivi
11. Points à vérifier avant validation (passages ambigus, éléments non abordés) — liste à cocher, non exportée

Toute rubrique non évoquée pendant la consultation est marquée « Non abordé » : le modèle n'invente rien.

## Installation

Prérequis : Node.js 20 ou plus récent, une clé API Anthropic.

```bash
npm install
cp .env.example .env      # puis renseigner ANTHROPIC_API_KEY
npm start
```

Ouvrir ensuite <http://127.0.0.1:3000> dans **Chrome, Edge ou Safari** (la dictée en direct repose sur la reconnaissance vocale du navigateur, disponible en français dans ces navigateurs ; Firefox ne la propose pas).

Pour essayer l'interface sans clé API : `AICONSULT_MOCK=1 npm start` renvoie un compte rendu fictif.

## Utilisation

1. **Démarrer** l'enregistrement en début de consultation. L'audio est capté et la transcription s'écrit en direct. Pause possible.
2. **Arrêter** en fin de consultation. L'audio reste écoutable et téléchargeable ; la transcription est corrigeable.
3. Ajouter au besoin des **notes complémentaires** (constantes, lecture de l'ECG, prescriptions exactes).
4. **Générer le compte rendu**. Avant l'envoi, l'application signale les passages qui ressemblent à des données identifiantes (civilité + nom, téléphone, date de naissance, adresse, numéro de sécurité sociale) et laisse le choix de corriger.
5. Relire et modifier chaque rubrique, puis **Copier**, **Télécharger (.md)** ou **Imprimer**.
6. **Nouvelle consultation** efface transcription, notes, compte rendu et brouillon local.

## Confidentialité

- Le serveur ne journalise ni ne stocke aucune donnée de consultation ; il n'écoute par défaut que sur `127.0.0.1`.
- La transcription et les notes sont envoyées à l'API Anthropic pour la rédaction. La consigne de rédaction impose d'omettre tout nom, date de naissance complète, adresse ou téléphone qui s'y glisserait.
- La dictée en direct utilise le service de reconnaissance vocale du navigateur (Google pour Chrome et Edge, Apple pour Safari) : l'audio transite par ce service. Pour l'éviter, configurez une transcription serveur (ci-dessous), par exemple vers un serveur Whisper local.
- Un brouillon (transcription, notes, compte rendu) est conservé dans le stockage local du navigateur uniquement, jusqu'à « Nouvelle consultation ».
- L'audio n'est jamais envoyé au serveur, sauf si vous demandez explicitement la transcription serveur.

## Transcription côté serveur (optionnelle)

Si le navigateur ne propose pas la dictée, ou pour transcrire un fichier audio importé, renseignez dans `.env` un point d'accès compatible avec l'API `audio/transcriptions` (format Whisper) :

```
TRANSCRIPTION_API_URL=http://localhost:8000/v1/audio/transcriptions   # ex. serveur Whisper local
TRANSCRIPTION_API_KEY=                                                 # si le service l'exige
TRANSCRIPTION_MODEL=whisper-1
```

Un bouton « Transcrire l'audio (serveur) » apparaît alors sous le lecteur audio.

## Configuration

| Variable | Rôle | Défaut |
|---|---|---|
| `ANTHROPIC_API_KEY` | Clé API Anthropic | — |
| `CLAUDE_MODEL` | Modèle de rédaction | `claude-opus-5` |
| `CLAUDE_EFFORT` | Effort de raisonnement (`low` à `max`) | `high` |
| `HOST` / `PORT` | Adresse et port d'écoute | `127.0.0.1` / `3000` |
| `AICONSULT_MOCK` | `1` pour un compte rendu fictif sans appel API | `0` |
| `TRANSCRIPTION_API_URL` | Transcription serveur (voir ci-dessus) | désactivée |

## Développement

```bash
npm run dev        # serveur avec rechargement automatique
npm run typecheck  # vérification TypeScript
npm test           # tests unitaires
```

Arborescence : `src/server.ts` (API Express), `src/report.ts` (appel à Claude, consigne de rédaction), `src/schema.ts` (structure du compte rendu), `src/transcribe.ts` (transcription serveur optionnelle), `public/` (interface).

## Limites

Le compte rendu est une aide à la rédaction : il doit être relu et validé par le médecin avant tout usage. La reconnaissance vocale du navigateur peut se tromper sur les termes médicaux ; les passages douteux sont signalés dans « Points à vérifier ».
