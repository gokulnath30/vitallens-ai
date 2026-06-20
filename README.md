# 🩺 VitalLens AI — Medical Report Explainer & Health Planner

> Upload a blood test or lab report → VitalLens reads it, explains every marker in plain language, and builds a personalized **diet**, **exercise**, and **daily-routine** plan. Snap a photo of your meals to track nutrition.

Built for the **Nebius Buildathon**, powered entirely by [**Nebius Token Factory**](https://tokenfactory.nebius.com) — an OpenAI-compatible inference API serving open-source models.

### 🔗 Live demo → **https://vitallens-06201128.web.app**

> First time? Click **⚙️ Settings**, paste your Nebius API token (kept only in your browser), then upload a report.

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

> **Nebius Token Factory is the entire AI backbone of VitalLens** — there is no other ML service, no self-hosted model, and no other inference provider. Every piece of intelligence in the app is a call to Token Factory's OpenAI-compatible API serving open-weight models.

### A multi-model, multimodal pipeline — not a single prompt

VitalLens deliberately uses **two specialized models on the same platform**, chosen for the job:

| Role | Model (Token Factory) | Why this model |
|------|----------------------|----------------|
| 👁 **Vision** | `Qwen/Qwen2.5-VL-72B-Instruct` | Reads lab-report images/PDFs and food photos — strong OCR + visual reasoning |
| 🧠 **Reasoning** | `Qwen/Qwen3-235B-A22B-Instruct-2507` | Turns extracted data into an explanation + plan, and powers the grounded chat |

Splitting **extraction** (vision) from **planning** (reasoning) means each step uses the right tool, the planner stays a clean *text-to-text* task, and either model can be swapped independently at runtime.

### Platform capabilities → how VitalLens uses them

| Token Factory capability | How we use it |
|--------------------------|---------------|
| **OpenAI-compatible Chat Completions** (`POST /v1/chat/completions`, Bearer auth) | Single integration point for every AI call — zero vendor lock-in |
| **Multimodal / vision input** | Report pages & meal photos sent as `image_url` content parts (data URLs) |
| **JSON mode** (`response_format: { type: "json_object" }`) | Reliable structured output that renders directly into the UI |
| **System prompts + multi-turn history** | The "Ask about your report" chat stays grounded in *your* results across turns |
| **Generation params** (`temperature`, `max_tokens`) | Tuned per step — precise extraction vs. warmer chat |
| **Open model catalog + runtime switching** | Swap models in ⚙️ Settings: `Qwen3-Next-80B-Thinking`, `Llama-3.3-70B-Instruct`, `gpt-oss-120b`, `MiniCPM-V-4_5` |

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

### 🔭 How we scale further on Token Factory (roadmap)

The same platform takes VitalLens from demo to production without changing stacks:

- **Prompt Presets** — develop, version & **share** the planner prompt (it's a clean text-to-text task) with the team, then export to code.
- **Fine-tuning (LoRA / SFT)** — train a small model (e.g. Qwen3-8B) on synthetic *labs → plan JSON* pairs for cheaper, schema-locked plans; fine-tune a doctor-chat on datasets like ChatDoctor for warmer answers.
- **Dedicated endpoints** — isolated GPU deployment with **EU data residency (GDPR)** and zero-retention — important for health data.
- **Built-in observability** — latency / TTFT / token-usage metrics (Prometheus + Grafana) to watch cost and quality.
- **Embeddings** (`Qwen3-Embedding-8B`) — index a user's past reports to track trends over time.

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

Live deployment: **https://vitallens-06201128.web.app**

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
