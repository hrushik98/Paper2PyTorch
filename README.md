# Paper2PyTorch

Live demo link: https://paper2-py-torch.vercel.app/

> Drop a research paper. Get a fully executable Jupyter notebook.

Paper2PyTorch uses four [Google ADK](https://google.github.io/adk-docs/) agents arranged in a sequential pipeline to transform any ML/AI research paper PDF into runnable PyTorch code.

## How It Works

```
PDF or arXiv URL
       │
       ▼
┌──────────────────┐
│ 01 Analyze Paper │  Extract algorithms, equations, architecture → JSON
└────────┬─────────┘
         │
         ▼
┌──────────────────────────┐
│ 02 Design Implementation │  Plan CPU-scale toy model → JSON
└────────┬─────────────────┘
         │
         ▼
┌─────────────────────┐
│ 03 Author Notebook  │  Write 12-section Jupyter notebook with real PyTorch
└────────┬────────────┘
         │
         ▼
┌───────────────────────┐
│ 04 Review & Repair    │  Fix imports, undefined vars, shape mismatches
└───────────────────────┘
         │
         ▼
  .ipynb  (download or open in Colab)
```

## Stack

| Layer     | Technology                              |
|-----------|-----------------------------------------|
| Agents    | Google ADK (SequentialAgent)            |
| LLM       | Gemini 2.5 Pro                          |
| Backend   | FastAPI + Python                        |
| Notebooks | nbformat                                |
| Frontend  | Next.js 14 + TypeScript + Tailwind CSS  |
| Streaming | Server-Sent Events (SSE)                |

## Quick Start

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env          # optionally set GOOGLE_API_KEY
python app.py                 # http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install

cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                         # http://localhost:3000
```

Users provide their own Gemini API key in the UI — no server-side key required.

## Environment Variables

| Variable           | Where    | Description                                    |
|--------------------|----------|------------------------------------------------|
| `GOOGLE_API_KEY`   | Backend  | Optional server-level Gemini key               |
| `GITHUB_TOKEN`     | Backend  | Required for "Open in Colab" Gist creation     |
| `MAX_UPLOAD_MB`    | Backend  | PDF size limit (default 30)                    |
| `NEXT_PUBLIC_API_URL` | Frontend | Backend URL                                 |

## License

MIT
