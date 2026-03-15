"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  Terminal,
  X,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type StepStatus = "pending" | "running" | "done" | "error";

interface PipelineStep {
  id: number;
  label: string;
  detail: string;
  status: StepStatus;
}

interface GenerationState {
  phase: "idle" | "running" | "draft" | "complete" | "error";
  steps: PipelineStep[];
  thinkingLines: string[];
  draftJobId: string | null;
  finalJobId: string | null;
  errorMsg: string | null;
  progress: number; // 0–100
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://paper2-py-torch-tsgq.vercel.app";

const INITIAL_STEPS: PipelineStep[] = [
  { id: 1, label: "Analyze Paper",         detail: "Extracting structure and equations",   status: "pending" },
  { id: 2, label: "Design Implementation", detail: "Planning toy architecture",             status: "pending" },
  { id: 3, label: "Author Notebook",       detail: "Writing PyTorch code",                  status: "pending" },
  { id: 4, label: "Review & Repair",       detail: "Checking for runtime errors",           status: "pending" },
];

const STEP_PROGRESS: Record<number, number> = { 1: 15, 2: 35, 3: 65, 4: 90 };

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(",");
  const mimeType = header.match(/:(.*?);/)?.[1] || "application/pdf";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function StepIndicator({
  step,
  isLast,
}: {
  step: PipelineStep;
  isLast: boolean;
}) {
  return (
    <div className="flex gap-3">
      {/* Icon column */}
      <div className="flex flex-col items-center">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
            step.status === "done"
              ? "bg-emerald-500/15 border border-emerald-500/40"
              : step.status === "running"
              ? "bg-accent/15 border border-accent/40"
              : step.status === "error"
              ? "bg-red-500/15 border border-red-500/40"
              : "bg-zinc-800 border border-zinc-700"
          }`}
        >
          {step.status === "done" ? (
            <Check size={12} className="text-emerald-400" />
          ) : step.status === "running" ? (
            <Loader2 size={12} className="text-accent animate-spin" />
          ) : step.status === "error" ? (
            <X size={12} className="text-red-400" />
          ) : (
            <Circle size={8} className="text-zinc-600" />
          )}
        </div>
        {!isLast && (
          <div
            className={`w-px flex-1 my-1 transition-colors duration-500 ${
              step.status === "done" ? "bg-emerald-500/30" : "bg-zinc-800"
            }`}
            style={{ minHeight: "20px" }}
          />
        )}
      </div>

      {/* Content */}
      <div className="pb-6">
        <div
          className={`font-mono text-sm font-medium transition-colors ${
            step.status === "running"
              ? "text-accent"
              : step.status === "done"
              ? "text-emerald-400"
              : step.status === "error"
              ? "text-red-400"
              : "text-zinc-500"
          }`}
        >
          {step.label}
        </div>
        <div className="text-xs text-zinc-600 mt-0.5">{step.detail}</div>
      </div>
    </div>
  );
}

function ApiKeyInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-2 w-full">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="AIzaSy…"
        className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent transition-colors"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
      <div
        className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function DownloadButton({
  label,
  jobId,
  variant = "ghost",
}: {
  label: string;
  jobId: string;
  variant?: "primary" | "ghost";
}) {
  const handleDownload = async () => {
    window.open(`${API_URL}/api/download/${jobId}`, "_blank");
  };
  return (
    <button
      onClick={handleDownload}
      className={`flex items-center gap-2 px-4 py-2 rounded font-mono text-sm transition-colors ${
        variant === "primary"
          ? "bg-accent hover:bg-accent-dim text-[#09090b] font-semibold"
          : "border border-zinc-700 hover:border-zinc-600 text-zinc-300 hover:text-zinc-100"
      }`}
    >
      <Download size={13} />
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function GeneratePage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("geminiApiKey") || "" : ""
  );
  const [state, setState] = useState<GenerationState>({
    phase: "idle",
    steps: INITIAL_STEPS,
    thinkingLines: [],
    draftJobId: null,
    finalJobId: null,
    errorMsg: null,
    progress: 0,
  });
  const [showThinking, setShowThinking] = useState(false);
  const [openColabLoading, setOpenColabLoading] = useState(false);
  const thinkingRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll thinking output
  useEffect(() => {
    if (thinkingRef.current) {
      thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
    }
  }, [state.thinkingLines]);

  // Save API key to localStorage
  useEffect(() => {
    if (apiKey) localStorage.setItem("geminiApiKey", apiKey);
  }, [apiKey]);

  // ── Step updater ────────────────────────────────────────────────────────────
  const setStepStatus = useCallback(
    (id: number, status: StepStatus, detail?: string) => {
      setState((s) => ({
        ...s,
        steps: s.steps.map((st) =>
          st.id === id ? { ...st, status, ...(detail ? { detail } : {}) } : st
        ),
      }));
    },
    []
  );

  const appendThinkingLine = useCallback((line: string) => {
    if (!line.trim()) return;
    setState((s) => ({
      ...s,
      thinkingLines: [...s.thinkingLines.slice(-300), line],
    }));
  }, []);

  // ── Start generation ────────────────────────────────────────────────────────
  const startGeneration = useCallback(async () => {
    if (!apiKey.trim()) return;

    // Save key
    localStorage.setItem("geminiApiKey", apiKey);

    // Load pending input from sessionStorage
    const pendingFile = sessionStorage.getItem("pendingFile");
    const pendingFileName = sessionStorage.getItem("pendingFileName");
    const pendingArxivUrl = sessionStorage.getItem("pendingArxivUrl");

    if (!pendingFile && !pendingArxivUrl) {
      setState((s) => ({
        ...s,
        phase: "error",
        errorMsg: "No paper found. Please go back and upload a PDF or enter an arXiv URL.",
      }));
      return;
    }

    // Reset state
    setState({
      phase: "running",
      steps: INITIAL_STEPS,
      thinkingLines: ["Pipeline started. Waiting for model responses..."],
      draftJobId: null,
      finalJobId: null,
      errorMsg: null,
      progress: 5,
    });

    // Build form data
    const formData = new FormData();
    formData.append("api_key", apiKey.trim());

    let endpoint = "";
    if (pendingFile && pendingFileName) {
      const blob = dataUrlToBlob(pendingFile);
      formData.append("file", blob, pendingFileName);
      endpoint = `${API_URL}/api/generate`;
    } else if (pendingArxivUrl) {
      formData.append("arxiv_url", pendingArxivUrl);
      endpoint = `${API_URL}/api/generate-from-arxiv`;
    }

    // Fire request
    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        body: formData,
        signal: abort.signal,
      });

      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(msg || `HTTP ${resp.status}`);
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.trim() || part.startsWith(":")) continue;

          const lines = part.split("\n");
          let eventName = "message";
          let dataStr = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) eventName = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataStr = line.slice(6).trim();
          }

          if (!dataStr) continue;

          try {
            const payload = JSON.parse(dataStr);
            handleSSEEvent(eventName, payload);
          } catch {
            /* skip malformed */
          }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string }).name === "AbortError") return;
      const msg = err instanceof Error ? err.message : String(err);
      setState((s) => ({
        ...s,
        phase: "error",
        errorMsg: msg,
        steps: s.steps.map((st) =>
          st.status === "running" ? { ...st, status: "error" } : st
        ),
      }));
    }
  }, [apiKey, setStepStatus]);

  function handleSSEEvent(event: string, payload: Record<string, unknown>) {
    switch (event) {
      case "thinking":
        appendThinkingLine(String(payload.text || ""));
        break;

      case "progress": {
        const step = Number(payload.step);
        const detail = String(payload.detail || "");
        const name = String(payload.name || `Step ${step}`);
        const isDone = detail.toLowerCase().includes("complete");

        if (isDone) {
          setStepStatus(step, "done", detail);
          appendThinkingLine(`✓ ${name}: ${detail}`);
          // Start next step if there is one
          if (step < 4) setStepStatus(step + 1, "running");
          setState((s) => ({
            ...s,
            progress: STEP_PROGRESS[step] || s.progress,
          }));
        } else {
          setStepStatus(step, "running", detail);
          appendThinkingLine(`→ ${name}: ${detail}`);
          setState((s) => ({
            ...s,
            progress: Math.max(s.progress, (STEP_PROGRESS[step] || 10) - 5),
          }));
        }
        break;
      }

      case "draft_ready":
        appendThinkingLine("Draft notebook is ready. Running final validation...");
        setState((s) => ({
          ...s,
          phase: "draft",
          draftJobId: String(payload.job_id || ""),
          progress: 70,
        }));
        break;

      case "complete":
        appendThinkingLine("✓ Pipeline complete. Final notebook generated.");
        setState((s) => ({
          ...s,
          phase: "complete",
          finalJobId: String(payload.job_id || ""),
          progress: 100,
          steps: s.steps.map((st) => ({ ...st, status: "done" as StepStatus })),
        }));
        break;

      case "error":
        appendThinkingLine(`✗ Error: ${String(payload.error || "Unknown error")}`);
        setState((s) => ({
          ...s,
          phase: "error",
          errorMsg: String(payload.error || "Unknown error"),
          steps: s.steps.map((st) =>
            st.status === "running" ? { ...st, status: "error" as StepStatus } : st
          ),
        }));
        break;
    }
  }

  // ── Open in Colab ───────────────────────────────────────────────────────────
  const openColab = async () => {
    if (!state.finalJobId) return;
    setOpenColabLoading(true);
    try {
      const resp = await fetch(
        `${API_URL}/api/create-gist/${state.finalJobId}`,
        { method: "POST" }
      );
      const data = await resp.json();
      if (data.colab_url) window.open(data.colab_url, "_blank");
      else alert("Could not create Gist. Check GITHUB_TOKEN on the server.");
    } catch {
      alert("Failed to create Gist.");
    } finally {
      setOpenColabLoading(false);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const isRunning = state.phase === "running";
  const isDraft = state.phase === "draft";
  const isComplete = state.phase === "complete";
  const isError = state.phase === "error";
  const hasOutput = isDraft || isComplete;

  const pendingArxivUrl =
    typeof window !== "undefined"
      ? sessionStorage.getItem("pendingArxivUrl")
      : null;
  const pendingFileName =
    typeof window !== "undefined"
      ? sessionStorage.getItem("pendingFileName")
      : null;
  const paperLabel = pendingArxivUrl || pendingFileName || "Research Paper";

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#09090b]">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-sm font-mono"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <div className="w-px h-4 bg-zinc-800" />
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-accent" />
              <span className="font-mono font-semibold text-sm text-zinc-100">
                Paper2PyTorch
              </span>
            </div>
          </div>

          <div
            className="text-xs font-mono text-zinc-600 truncate max-w-xs"
            title={paperLabel}
          >
            {paperLabel}
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          {/* ── Left: Step tracker ─────────────────────────────────────────── */}
          <aside>
            <div className="sticky top-8">
              <div className="text-xs font-mono text-zinc-600 uppercase tracking-widest mb-6">
                Pipeline
              </div>

              <div>
                {state.steps.map((step, i) => (
                  <StepIndicator
                    key={step.id}
                    step={step}
                    isLast={i === state.steps.length - 1}
                  />
                ))}
              </div>

              {/* Progress bar */}
              {(isRunning || isDraft || isComplete) && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs font-mono text-zinc-600 mb-2">
                    <span>Progress</span>
                    <span>{state.progress}%</span>
                  </div>
                  <ProgressBar value={state.progress} />
                </div>
              )}

              {/* Actions */}
              {(hasOutput || isComplete) && (
                <div className="mt-8 flex flex-col gap-2">
                  {state.finalJobId && (
                    <DownloadButton
                      label="Download Notebook"
                      jobId={state.finalJobId}
                      variant="primary"
                    />
                  )}
                  {state.draftJobId && !state.finalJobId && (
                    <DownloadButton
                      label="Download Draft"
                      jobId={state.draftJobId}
                    />
                  )}
                  {state.finalJobId && (
                    <button
                      onClick={openColab}
                      disabled={openColabLoading}
                      className="flex items-center gap-2 px-4 py-2 rounded border border-zinc-700 hover:border-zinc-600 text-zinc-300 hover:text-zinc-100 font-mono text-sm transition-colors disabled:opacity-50"
                    >
                      {openColabLoading ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <ExternalLink size={13} />
                      )}
                      Open in Colab
                    </button>
                  )}
                </div>
              )}
            </div>
          </aside>

          {/* ── Right: Main panel ──────────────────────────────────────────── */}
          <main className="min-h-[60vh]">
            {/* Idle: API key + start */}
            {state.phase === "idle" && (
              <div className="animate-slide-up">
                <div className="border border-zinc-800 rounded-lg p-8 bg-surface max-w-xl">
                  <div className="text-xs font-mono text-zinc-600 uppercase tracking-widest mb-6">
                    Ready to Generate
                  </div>

                  <div className="mb-2">
                    <label className="block text-sm font-mono text-zinc-300 mb-2">
                      Gemini API Key
                    </label>
                    <ApiKeyInput value={apiKey} onChange={setApiKey} />
                    <p className="text-xs text-zinc-600 mt-2">
                      Your key is stored locally and never sent to our servers —
                      only to Google&apos;s API directly.
                    </p>
                  </div>

                  <div className="mt-6 pt-6 border-t border-zinc-800">
                    <div className="text-sm text-zinc-500 mb-4">
                      <span className="font-mono text-zinc-400">Source: </span>
                      {paperLabel}
                    </div>
                    <button
                      onClick={startGeneration}
                      disabled={!apiKey.trim()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded bg-accent hover:bg-accent-dim text-[#09090b] font-mono font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Terminal size={14} />
                      Start Pipeline
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Running: thinking output */}
            {(isRunning || isDraft) && (
              <div className="animate-fade-in">
                <div className="border border-zinc-800 rounded-lg overflow-hidden">
                  {/* Header */}
                  <button
                    className="w-full flex items-center justify-between px-5 py-3 border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors"
                    onClick={() => setShowThinking((s) => !s)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent pulse-dot" />
                      <span className="font-mono text-xs text-zinc-400">
                        Agent Reasoning
                      </span>
                      <span className="font-mono text-xs text-zinc-600">
                        ({state.thinkingLines.length} lines)
                      </span>
                    </div>
                    {showThinking ? (
                      <ChevronUp size={14} className="text-zinc-600" />
                    ) : (
                      <ChevronDown size={14} className="text-zinc-600" />
                    )}
                  </button>

                  {showThinking && (
                    <div
                      ref={thinkingRef}
                      className="h-80 overflow-y-auto p-5 bg-zinc-950"
                    >
                      {state.thinkingLines.length === 0 ? (
                        <div className="terminal-text text-zinc-700 italic">
                          Waiting for reasoning tokens…
                        </div>
                      ) : (
                        state.thinkingLines.map((line, i) => (
                          <div key={i} className="terminal-text">
                            {line || "\u00A0"}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Draft available banner */}
                {isDraft && state.draftJobId && (
                  <div className="mt-4 flex items-center justify-between p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 animate-slide-up">
                    <div>
                      <div className="font-mono text-sm text-amber-400 font-medium">
                        Draft notebook ready
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        Validation is running in the background
                      </div>
                    </div>
                    <DownloadButton
                      label="Draft"
                      jobId={state.draftJobId}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Complete */}
            {isComplete && state.finalJobId && (
              <div className="animate-slide-up">
                <div className="border border-emerald-500/20 rounded-lg p-8 bg-emerald-500/5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
                      <Check size={14} className="text-emerald-400" />
                    </div>
                    <div>
                      <div className="font-mono font-semibold text-emerald-400">
                        Notebook Ready
                      </div>
                      <div className="text-xs text-zinc-500">
                        All four agents completed successfully
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                    <button
                      onClick={() =>
                        window.open(
                          `${API_URL}/api/download/${state.finalJobId}`,
                          "_blank"
                        )
                      }
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded bg-accent hover:bg-accent-dim text-[#09090b] font-mono font-semibold text-sm transition-colors"
                    >
                      <Download size={13} />
                      Download Notebook
                    </button>

                    {state.draftJobId && (
                      <button
                        onClick={() =>
                          window.open(
                            `${API_URL}/api/download/${state.draftJobId}`,
                            "_blank"
                          )
                        }
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded border border-zinc-700 hover:border-zinc-600 text-zinc-300 font-mono text-sm transition-colors"
                      >
                        <Download size={13} />
                        Download Draft
                      </button>
                    )}

                    <button
                      onClick={openColab}
                      disabled={openColabLoading}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded border border-zinc-700 hover:border-zinc-600 text-zinc-300 font-mono text-sm transition-colors disabled:opacity-50"
                    >
                      {openColabLoading ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <ExternalLink size={13} />
                      )}
                      Open in Colab
                    </button>
                  </div>
                </div>

                {/* Show thinking toggle after complete */}
                {state.thinkingLines.length > 0 && (
                  <div className="mt-4 border border-zinc-800 rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-5 py-3 border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors"
                      onClick={() => setShowThinking((s) => !s)}
                    >
                      <div className="flex items-center gap-2">
                        <Terminal size={12} className="text-zinc-600" />
                        <span className="font-mono text-xs text-zinc-500">
                          Agent Reasoning Log
                        </span>
                      </div>
                      {showThinking ? (
                        <ChevronUp size={14} className="text-zinc-600" />
                      ) : (
                        <ChevronDown size={14} className="text-zinc-600" />
                      )}
                    </button>
                    {showThinking && (
                      <div
                        ref={thinkingRef}
                        className="h-64 overflow-y-auto p-5 bg-zinc-950"
                      >
                        {state.thinkingLines.map((line, i) => (
                          <div key={i} className="terminal-text">
                            {line || "\u00A0"}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {isError && (
              <div className="animate-slide-up">
                <div className="border border-red-500/20 rounded-lg p-8 bg-red-500/5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-red-500/15 border border-red-500/40 flex items-center justify-center shrink-0 mt-0.5">
                      <X size={14} className="text-red-400" />
                    </div>
                    <div>
                      <div className="font-mono font-semibold text-red-400 mb-1">
                        Pipeline Failed
                      </div>
                      <div className="text-sm text-zinc-400 font-mono break-all">
                        {state.errorMsg}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setState((s) => ({
                        ...s,
                        phase: "idle",
                        steps: INITIAL_STEPS,
                        errorMsg: null,
                        progress: 0,
                      }))
                    }
                    className="mt-4 px-4 py-2 rounded border border-zinc-700 hover:border-zinc-600 text-zinc-300 font-mono text-sm transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
