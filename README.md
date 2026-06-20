# 🩺 VitalLens AI — Medical Report Explainer & Health Planner

> Upload a blood test or lab report → VitalLens reads it, explains every marker in plain language, and builds a personalized **diet**, **exercise**, and **daily-routine** plan. Snap a photo of your meals to track nutrition.

Built for the **Nebius Buildathon**, powered entirely by [**Nebius Token Factory**](https://tokenfactory.nebius.com) — an OpenAI-compatible inference API serving open-source models.

---

## ✨ Features

| # | Feature | What it does |
|---|---------|--------------|
| 1 | **Report upload** | Drag-and-drop a PDF or image (JPG/PNG). PDFs are rendered to images client-side with PDF.js. |
| 2 | **Vision extraction** | A vision model reads the report image(s) and extracts every lab marker (value, unit, reference range, flag) — no interpretation, just data. |
| 3 | **Plain-language explanation** | A reasoning model turns raw markers into an overall **health score**, a friendly summary, per-marker meaning, and "worth your attention" concerns. |
| 4 | **Personalized plan** | Tailored **Diet** (eat / limit / sample day), **Exercise**, and a full **Daily routine** timeline based on the findings. |
| 5 | **Visual results** | Health meter, Low–Normal–High marker bars with a pointer, and color-coded status badges for low-literacy comprehension. |
| 6 | **Ask about your report** | A chat assistant grounded in *your* results — short, reassuring, non-diagnostic answers. |
| 7 | **Meal tracking** | Snap a food photo → the vision model estimates calories/protein/carbs/fat, a health score, and one improvement tip. |
| 8 | **Daily reminders** | Optional browser notifications to nudge you through your routine. |

---

## 🧠 What we use from Nebius Token Factory

The app talks to Token Factory's **OpenAI-compatible Chat Completions endpoint** (`POST /v1/chat/completions`, Bearer-token auth). Specifically:

- **Two hosted open-source models**
  - **Vision** — `Qwen/Qwen2.5-VL-72B-Instruct` → reads report images & food photos
  - **Reasoning** — `Qwen/Qwen3-235B-A22B-Instruct-2507` → writes the health plan & answers chat
- **Vision / multimodal input** — images sent as `image_url` content parts (data URLs)
- **JSON mode** — `response_format: { type: "json_object" }` for reliable structured output
- **Standard generation params** — `temperature`, `max_tokens`, multi-turn message history

Models and base URL are configurable at runtime in **⚙️ Settings** (alternatives include `Qwen3-Next-80B-Thinking`, `Llama-3.3-70B-Instruct`, `gpt-oss-120b`, `MiniCPM-V-4_5`).

### Pipeline

```
Report image/PDF
      │
      ▼  (Qwen2.5-VL — vision)
  Extract raw lab markers  ──►  JSON
      │
      ▼  (Qwen3-235B — reasoning)
  Health score + explanation + diet/exercise/routine  ──►  JSON  ──►  UI
      │
      ▼  (Qwen3-235B — reasoning)
  "Ask about your report" chat, grounded in the results

Food photo  ──►  (Qwen2.5-VL — vision)  ──►  Nutrition estimate JSON  ──►  UI
```

---

## 🛠 Tech stack

- **Frontend:** Vanilla JS + Tailwind CSS (CDN), no build step
- **PDF rendering:** PDF.js · **Markdown:** marked.js
- **AI:** Nebius Token Factory (OpenAI-compatible API)
- **Hosting:** Firebase Hosting

No backend — the browser calls the Nebius API directly. The API token is entered in Settings and kept only in `localStorage`.

---

## 🚀 Run locally

```bash
# Clone
git clone https://github.com/gokulnath30/vitallens-ai.git
cd vitallens-ai

# Serve the static site (any static server works)
npx serve public
#   or
python -m http.server 8000 --directory public
```

Open the URL, click **⚙️ Settings**, paste your **Nebius API token**, and upload a report.

> Get a token at <https://tokenfactory.nebius.com>.

---

## ☁️ Deploy (Firebase Hosting)

```bash
npm install -g firebase-tools
firebase login
firebase deploy
```

Config lives in `firebase.json` (serves the `public/` folder) and `.firebaserc`.

---

## 📁 Project structure

```
.
├── public/
│   ├── index.html   # UI — upload, results, plan, chat, food tracking
│   ├── app.js       # All logic + Nebius API calls
│   └── config.js    # Default base URL & model names (no secrets)
├── firebase.json    # Firebase Hosting config
├── .firebaserc      # Firebase project alias
├── .env.example     # Token placeholder (copy to .env, never commit .env)
└── README.md
```

---

## 🔒 Security

- **No secrets in the repo.** `.env` (real token) is git-ignored; `config.js` ships with an empty `apiKey`.
- The token is supplied by the user at runtime and stored only in their browser's `localStorage`.

---

## ⚕️ Disclaimer

VitalLens AI is for **educational use only** and is **not a substitute for professional medical advice, diagnosis, or treatment**. Always consult a qualified doctor about your health.
