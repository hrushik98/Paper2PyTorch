"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  FileText,
  Link2,
  ChevronRight,
  Cpu,
  GitBranch,
  Layers,
  Search,
  Terminal,
  Zap,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  {
    n: "01",
    label: "Analyze",
    desc: "Extract algorithms, equations, and architecture from the paper",
    icon: Search,
  },
  {
    n: "02",
    label: "Design",
    desc: "Plan a minimal CPU-scale implementation that captures the core idea",
    icon: GitBranch,
  },
  {
    n: "03",
    label: "Generate",
    desc: "Write a complete 12-section Jupyter notebook with real PyTorch code",
    icon: Terminal,
  },
  {
    n: "04",
    label: "Validate",
    desc: "Review for missing imports, undefined variables, and broken logic",
    icon: Zap,
  },
];

const SAMPLE_PAPERS = [
  "Attention Is All You Need",
  "BERT: Pre-training of Deep Bidirectional Transformers",
  "An Image is Worth 16×16 Words (ViT)",
  "Denoising Diffusion Probabilistic Models",
  "Deep Residual Learning for Image Recognition",
  "Language Models are Few-Shot Learners (GPT-3)",
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border border-zinc-700 bg-zinc-800 text-zinc-400">
      {children}
    </kbd>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono border border-accent/30 text-accent bg-accent/5">
      {children}
    </span>
  );
}

function FeatureTag({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-zinc-400 text-sm">
      <Icon size={14} className="text-accent shrink-0" />
      <span>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [arxivUrl, setArxivUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      sessionStorage.setItem("pendingFile", reader.result as string);
      sessionStorage.setItem("pendingFileName", file.name);
      sessionStorage.removeItem("pendingArxivUrl");
      router.push("/generate");
    };
    reader.readAsDataURL(file);
  }, [router]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  // ── arXiv handling ─────────────────────────────────────────────────────────
  const handleArxivSubmit = () => {
    if (!arxivUrl.trim()) return;
    sessionStorage.setItem("pendingArxivUrl", arxivUrl.trim());
    sessionStorage.removeItem("pendingFile");
    sessionStorage.removeItem("pendingFileName");
    router.push("/generate");
  };

  return (
    <div className="min-h-screen bg-[#09090b] grid-bg">
      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-accent" />
            <span className="font-mono font-semibold text-sm text-zinc-100">
              Paper2PyTorch
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Badge>
              <span className="w-1.5 h-1.5 rounded-full bg-accent pulse-dot" />
              Powered by Google ADK
            </Badge>
            <a
              href="https://github.com/hrushik98/Paper2PyTorch"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm font-mono"
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6">
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="pt-20 pb-16">
          <div className="max-w-2xl">
            <div className="font-mono text-xs text-muted mb-6 tracking-widest uppercase">
              Research Paper → PyTorch Implementation
            </div>

            <h1 className="font-mono text-5xl font-semibold leading-tight mb-6 text-zinc-50">
              Drop a paper.
              <br />
              <span className="text-accent">Get working code.</span>
              <span className="inline-block w-0.5 h-10 bg-accent ml-1 align-bottom animate-cursor-blink" />
            </h1>

            <p className="text-zinc-400 text-lg leading-relaxed mb-8 max-w-xl">
              Four ADK agents analyze the paper, plan a minimal implementation,
              write complete PyTorch code, and repair it — producing a
              runnable Jupyter notebook in minutes.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <FeatureTag icon={Cpu} label="CPU-runnable" />
              <FeatureTag icon={FileText} label="Baseline vs paper model" />
              <FeatureTag icon={Zap} label="Auto-repairs broken imports" />
              <FeatureTag icon={GitBranch} label="Open in Colab" />
            </div>
          </div>
        </section>

        {/* ── Upload section ────────────────────────────────────────────────── */}
        <section className="pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* PDF Upload */}
            <div
              className={`border rounded-lg p-8 transition-all cursor-pointer group ${
                isDragging
                  ? "border-accent bg-accent/5"
                  : "border-zinc-800 hover:border-zinc-700 bg-surface"
              }`}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
              <div className="flex flex-col items-start gap-4">
                <div className="w-10 h-10 rounded-lg border border-zinc-700 flex items-center justify-center group-hover:border-zinc-600 transition-colors">
                  <FileText size={20} className="text-zinc-400" />
                </div>
                <div>
                  <div className="font-mono font-medium text-zinc-200 mb-1">
                    Upload PDF
                  </div>
                  <div className="text-sm text-zinc-500">
                    Drag & drop or click to browse
                  </div>
                  <div className="text-xs text-zinc-600 mt-2 font-mono">
                    Max 30 MB · PDF only
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-600 font-mono">
                  <Kbd>drag</Kbd>
                  <span>or</span>
                  <Kbd>click</Kbd>
                </div>
              </div>
            </div>

            {/* arXiv URL */}
            <div className="border border-zinc-800 rounded-lg p-8 bg-surface">
              <div className="flex flex-col gap-4 h-full">
                <div className="w-10 h-10 rounded-lg border border-zinc-700 flex items-center justify-center">
                  <Link2 size={20} className="text-zinc-400" />
                </div>
                <div>
                  <div className="font-mono font-medium text-zinc-200 mb-1">
                    arXiv URL
                  </div>
                  <div className="text-sm text-zinc-500">
                    Paste an arXiv abstract or PDF link
                  </div>
                </div>
                <div className="flex gap-2 mt-auto">
                  <input
                    type="url"
                    value={arxivUrl}
                    onChange={(e) => setArxivUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleArxivSubmit()}
                    placeholder="https://arxiv.org/abs/2303.08774"
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent transition-colors"
                  />
                  <button
                    onClick={handleArxivSubmit}
                    disabled={!arxivUrl.trim()}
                    className="px-3 py-2 rounded bg-accent hover:bg-accent-dim text-[#09090b] font-mono font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sample papers hint */}
          <div className="mt-6">
            <div className="text-xs font-mono text-zinc-600 mb-2 uppercase tracking-widest">
              Example papers
            </div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_PAPERS.map((p) => (
                <span
                  key={p}
                  className="text-xs font-mono px-2 py-1 rounded border border-zinc-800 text-zinc-500 hover:text-zinc-400 hover:border-zinc-700 transition-colors cursor-default"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pipeline visualization ─────────────────────────────────────────── */}
        <section className="border-t border-zinc-800 py-20">
          <div className="text-xs font-mono text-zinc-600 mb-12 uppercase tracking-widest">
            The Pipeline
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-800 rounded-lg overflow-hidden">
            {PIPELINE_STEPS.map((step) => (
              <div
                key={step.n}
                className="bg-[#09090b] p-6 flex flex-col gap-4 hover:bg-surface transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-zinc-600">
                    {step.n}
                  </span>
                  <step.icon size={14} className="text-accent" />
                </div>
                <div>
                  <div className="font-mono font-semibold text-zinc-100 mb-1.5">
                    {step.label}
                  </div>
                  <div className="text-zinc-500 text-sm leading-relaxed">
                    {step.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── What you get ──────────────────────────────────────────────────── */}
        <section className="border-t border-zinc-800 py-20">
          <div className="text-xs font-mono text-zinc-600 mb-12 uppercase tracking-widest">
            What You Get
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "Baseline vs Paper",
                desc: "Two nn.Module implementations: the competing method and the paper's proposed approach — trained side by side.",
              },
              {
                title: "12-Section Notebook",
                desc: "Title, intuition, setup, data pipeline, models, training loop, experiment, inference, visualizations, and reflection.",
              },
              {
                title: "Auto-Repaired Code",
                desc: "A dedicated review agent catches undefined variables, missing imports, and shape mismatches before you run a single cell.",
              },
              {
                title: "CPU-Friendly Scale",
                desc: "Architectures are reduced to train in minutes on a laptop — preserve the core idea, skip the GPU cluster.",
              },
              {
                title: "Draft + Final",
                desc: "Download the generated draft while validation runs in the background. Both versions available.",
              },
              {
                title: "Open in Colab",
                desc: "One click publishes the notebook as a GitHub Gist and opens it directly in Google Colab.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="border border-zinc-800 rounded-lg p-5 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <ChevronRight size={12} className="text-accent" />
                  <span className="font-mono font-medium text-zinc-200 text-sm">
                    {item.title}
                  </span>
                </div>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800 px-6 py-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs font-mono text-zinc-600">
          <span>Paper2PyTorch — MIT License</span>
          <span>
            Powered by{" "}
            <span className="text-accent">Google ADK</span> +{" "}
            <span className="text-zinc-400">Gemini</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
