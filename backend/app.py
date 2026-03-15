#!/usr/bin/env python3
"""
Paper2PyTorch — Backend API
FastAPI application powered by Google ADK agents.
Converts research paper PDFs into executable Jupyter notebooks.
"""
from __future__ import annotations

import asyncio
import io
import json
import os
import re
import tempfile
import time
import uuid
from typing import Callable, Optional

import nbformat
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from nbformat.v4 import new_code_cell, new_markdown_cell, new_notebook

load_dotenv()

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

MAX_PDF_MB = int(os.environ.get("MAX_UPLOAD_MB", "30"))

# One pipeline at a time to avoid GOOGLE_API_KEY env-var races.
# The pipeline itself is long-running, so single-slot is acceptable.
_pipeline_lock = asyncio.Lock()

TEMP_DIR = tempfile.mkdtemp(prefix="p2pt_")

# ─────────────────────────────────────────────────────────────────────────────
# NOTEBOOK UTILITIES
# ─────────────────────────────────────────────────────────────────────────────

def parse_json_output(raw: str) -> list | dict:
    """Strip markdown fences and parse JSON, with one repair attempt."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        # Best-effort: find the outermost JSON array or object
        for start_char, end_char in [("[", "]"), ("{", "}")]:
            s = text.find(start_char)
            e = text.rfind(end_char)
            if s != -1 and e != -1 and e > s:
                try:
                    return json.loads(text[s : e + 1])
                except json.JSONDecodeError:
                    pass
        raise ValueError(f"Cannot parse LLM output as JSON: {exc}") from exc


def build_notebook(cells: list) -> nbformat.NotebookNode:
    nb = new_notebook()
    nb.metadata.kernelspec = {
        "display_name": "Python 3",
        "language": "python",
        "name": "python3",
    }
    nb.metadata.language_info = {"name": "python", "version": "3.10"}
    for cell in cells:
        ct = cell.get("cell_type", "code")
        src = cell.get("source", "")
        nb.cells.append(new_markdown_cell(src) if ct == "markdown" else new_code_cell(src))
    return nb


def nb_to_bytes(nb: nbformat.NotebookNode) -> bytes:
    buf = io.StringIO()
    nbformat.write(nb, buf)
    return buf.getvalue().encode("utf-8")


# ─────────────────────────────────────────────────────────────────────────────
# ADK PIPELINE RUNNER
# ─────────────────────────────────────────────────────────────────────────────

async def run_adk_pipeline(
    pdf_bytes: bytes,
    api_key: str,
    on_progress: Callable[[int, str, str, Optional[dict]], None],
    on_thinking: Callable[[str], None],
    on_draft: Callable[[bytes], None],
) -> bytes:
    """
    Execute the 4-step ADK SequentialAgent pipeline.

    Acquires the pipeline lock, sets the API key, runs the runner,
    streams progress/thinking events, and returns final .ipynb bytes.
    """
    from agents.pipeline import PIPELINE_STEPS, create_pipeline
    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService
    from google.genai import types

    async with _pipeline_lock:
        # ── Configure Gemini client ──────────────────────────────────────────
        old_key = os.environ.get("GOOGLE_API_KEY")
        os.environ["GOOGLE_API_KEY"] = api_key
        os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "False"

        try:
            session_service = InMemorySessionService()
            session = await session_service.create_session(
                app_name="paper2pytorch",
                user_id="pipeline_user",
            )

            pipeline = create_pipeline()
            runner = Runner(
                agent=pipeline,
                app_name="paper2pytorch",
                session_service=session_service,
            )

            # ── Build initial multimodal message ────────────────────────────
            initial_message = types.Content(
                role="user",
                parts=[
                    types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
                    types.Part.from_text(
                        text="Run the complete Paper2PyTorch pipeline on this paper: "
                        "analyze it, design a minimal implementation, author a "
                        "full Jupyter notebook with PyTorch code, then review "
                        "and repair the notebook cells."
                    ),
                ],
            )

            # ── Stream runner events ─────────────────────────────────────────
            seen_steps: set[str] = set()
            agent_text_buffers: dict[str, str] = {}
            draft_emitted = False

            async for event in runner.run_async(
                user_id="pipeline_user",
                session_id=session.id,
                new_message=initial_message,
            ):
                author = getattr(event, "author", None)
                if not author or author not in PIPELINE_STEPS:
                    continue

                step_num, step_name, step_detail = PIPELINE_STEPS[author]

                # Emit progress on first event from each agent
                if author not in seen_steps:
                    seen_steps.add(author)
                    on_progress(step_num, step_name, step_detail, None)

                # Collect text + stream thinking tokens
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        is_thought = getattr(part, "thought", False)
                        text = getattr(part, "text", None) or ""
                        if is_thought and text:
                            on_thinking(text)
                        elif text and not is_thought:
                            agent_text_buffers[author] = (
                                agent_text_buffers.get(author, "") + text
                            )

                # On final response, emit step-complete + draft if applicable
                if event.is_final_response():
                    if author == "notebook_author" and not draft_emitted:
                        try:
                            raw = agent_text_buffers.get("notebook_author", "")
                            cells = parse_json_output(raw)
                            draft_bytes = nb_to_bytes(build_notebook(cells))
                            on_draft(draft_bytes)
                            draft_emitted = True
                        except Exception as exc:
                            print(f"[warn] Could not build draft notebook: {exc}")

                    on_progress(
                        step_num,
                        step_name,
                        f"{step_name} complete",
                        {"step_done": step_num},
                    )

            # ── Extract final cells from session state ───────────────────────
            final_session = await session_service.get_session(
                app_name="paper2pytorch",
                user_id="pipeline_user",
                session_id=session.id,
            )

            cells_raw = (
                final_session.state.get("final_cells")
                or final_session.state.get("raw_cells")
                or agent_text_buffers.get("code_reviewer")
                or agent_text_buffers.get("notebook_author")
                or "[]"
            )

            cells = parse_json_output(cells_raw)
            nb = build_notebook(cells)
            return nb_to_bytes(nb)

        finally:
            if old_key is not None:
                os.environ["GOOGLE_API_KEY"] = old_key
            else:
                os.environ.pop("GOOGLE_API_KEY", None)


# ─────────────────────────────────────────────────────────────────────────────
# SSE HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


def build_event_stream(pdf_bytes: bytes, api_key: str, job_id: str):
    """Return an async generator that runs the pipeline and yields SSE strings."""

    draft_id = job_id + "_draft"

    async def _stream():
        loop = asyncio.get_event_loop()
        queue: asyncio.Queue = asyncio.Queue()

        def on_progress(step, name, detail, extra):
            asyncio.run_coroutine_threadsafe(
                queue.put(("progress", step, name, detail, extra)), loop
            )

        def on_thinking(text):
            asyncio.run_coroutine_threadsafe(
                queue.put(("thinking", text)), loop
            )

        def on_draft(draft_bytes):
            asyncio.run_coroutine_threadsafe(
                queue.put(("draft", draft_bytes)), loop
            )

        async def _run():
            return await run_adk_pipeline(
                pdf_bytes, api_key, on_progress, on_thinking, on_draft
            )

        task = asyncio.create_task(_run())

        while not task.done():
            try:
                item = await asyncio.wait_for(queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"
                continue

            kind = item[0]
            if kind == "thinking":
                yield sse("thinking", {"text": item[1]})
            elif kind == "progress":
                _, step, name, detail, extra = item
                payload: dict = {"step": step, "name": name, "detail": detail}
                if extra:
                    payload["extra"] = extra
                yield sse("progress", payload)
            elif kind == "draft":
                draft_bytes = item[1]
                path = os.path.join(TEMP_DIR, f"{draft_id}.ipynb")
                with open(path, "wb") as f:
                    f.write(draft_bytes)
                yield sse("draft_ready", {
                    "job_id": draft_id,
                    "size_kb": len(draft_bytes) // 1024,
                })

        # Drain remaining queue items
        while not queue.empty():
            item = await queue.get()
            if item[0] == "thinking":
                continue
            if item[0] == "draft":
                continue
            _, step, name, detail, extra = item
            payload = {"step": step, "name": name, "detail": detail}
            if extra:
                payload["extra"] = extra
            yield sse("progress", payload)

        # Emit final result or error
        try:
            notebook_bytes = task.result()
            path = os.path.join(TEMP_DIR, f"{job_id}.ipynb")
            with open(path, "wb") as f:
                f.write(notebook_bytes)
            yield sse("complete", {
                "job_id": job_id,
                "size_kb": len(notebook_bytes) // 1024,
            })
        except Exception as exc:
            yield sse("error", {"error": str(exc)})

    return _stream()


# ─────────────────────────────────────────────────────────────────────────────
# FASTAPI APPLICATION
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Paper2PyTorch API",
    version="1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "service": "Paper2PyTorch",
        "version": "1.0",
        "powered_by": "Google ADK + Gemini",
        "endpoints": {
            "generate_pdf":   "POST /api/generate",
            "generate_arxiv": "POST /api/generate-from-arxiv",
            "download":       "GET  /api/download/{job_id}",
            "create_gist":    "POST /api/create-gist/{job_id}",
            "health":         "GET  /health",
        },
    }


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0"}


@app.post("/api/generate")
async def generate_from_pdf(
    request: Request,
    file: UploadFile = File(...),
    api_key: str = Form(...),
):
    """Accept a PDF upload and stream notebook generation via SSE."""
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Uploaded file must be a PDF.")

    api_key = api_key.strip()
    if not api_key:
        raise HTTPException(400, "A Gemini API key is required.")

    pdf_bytes = await file.read()
    size_mb = len(pdf_bytes) / (1024 * 1024)
    if size_mb > MAX_PDF_MB:
        raise HTTPException(413, f"PDF is {size_mb:.1f} MB — limit is {MAX_PDF_MB} MB.")

    job_id = uuid.uuid4().hex[:12]
    return StreamingResponse(
        build_event_stream(pdf_bytes, api_key, job_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/generate-from-arxiv")
async def generate_from_arxiv(
    request: Request,
    arxiv_url: str = Form(...),
    api_key: str = Form(...),
):
    """Download a PDF from arXiv then stream notebook generation via SSE."""
    try:
        import httpx
    except ImportError:
        raise HTTPException(500, "httpx is not installed.")

    api_key = api_key.strip()
    if not api_key:
        raise HTTPException(400, "A Gemini API key is required.")

    match = re.search(r"arxiv\.org/(?:abs|pdf)/([0-9]+\.[0-9]+)", arxiv_url)
    if not match:
        raise HTTPException(
            400, "Invalid arXiv URL. Expected https://arxiv.org/abs/XXXX.XXXXX"
        )

    paper_id = match.group(1)
    pdf_url = f"https://arxiv.org/pdf/{paper_id}.pdf"

    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            resp = await client.get(pdf_url, timeout=30.0)
            if resp.status_code != 200:
                raise HTTPException(500, f"arXiv returned HTTP {resp.status_code}.")
            pdf_bytes = resp.content
    except httpx.HTTPError as exc:
        raise HTTPException(500, f"Could not download PDF: {exc}")

    size_mb = len(pdf_bytes) / (1024 * 1024)
    if size_mb > MAX_PDF_MB:
        raise HTTPException(413, f"PDF is {size_mb:.1f} MB — limit is {MAX_PDF_MB} MB.")

    job_id = uuid.uuid4().hex[:12]
    return StreamingResponse(
        build_event_stream(pdf_bytes, api_key, job_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/download/{job_id}")
async def download_notebook(job_id: str):
    """Download a previously generated .ipynb file."""
    if len(job_id) > 100 or not re.match(r"^[a-zA-Z0-9_]+$", job_id):
        raise HTTPException(400, "Invalid job ID.")
    path = os.path.join(TEMP_DIR, f"{job_id}.ipynb")
    if not os.path.exists(path):
        raise HTTPException(404, "Notebook not found or expired.")
    return FileResponse(
        path,
        media_type="application/x-ipynb+json",
        filename="paper2pytorch_notebook.ipynb",
    )


@app.post("/api/create-gist/{job_id}")
async def create_gist(job_id: str):
    """Create a public GitHub Gist from a generated notebook for Colab."""
    try:
        import httpx
    except ImportError:
        raise HTTPException(500, "httpx is not installed.")

    if len(job_id) > 100 or not re.match(r"^[a-zA-Z0-9_]+$", job_id):
        raise HTTPException(400, "Invalid job ID.")

    path = os.path.join(TEMP_DIR, f"{job_id}.ipynb")
    if not os.path.exists(path):
        raise HTTPException(404, "Notebook not found.")

    github_token = os.getenv("GITHUB_TOKEN")
    if not github_token:
        raise HTTPException(500, "GITHUB_TOKEN is not configured on the server.")

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.github.com/gists",
            json={
                "description": "Paper2PyTorch — Generated Implementation",
                "public": True,
                "files": {"notebook.ipynb": {"content": content}},
            },
            headers={
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {github_token}",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            timeout=10.0,
        )

    if resp.status_code != 201:
        raise HTTPException(500, f"GitHub API error {resp.status_code}: {resp.text}")

    data = resp.json()
    gist_id = data["id"]
    owner = data["owner"]["login"]
    filename = list(data["files"].keys())[0]
    colab_url = f"https://colab.research.google.com/gist/{owner}/{gist_id}/{filename}"

    return {
        "gist_id": gist_id,
        "gist_url": data["html_url"],
        "colab_url": colab_url,
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
