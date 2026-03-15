"""
Paper2PyTorch — ADK Agent Pipeline

Four sequential agents that transform a research paper PDF into
a fully executable Jupyter notebook with PyTorch implementations.
"""
from __future__ import annotations

from google.adk.agents import Agent, SequentialAgent
from google.genai import types as genai_types

# ─────────────────────────────────────────────────────────────────────────────
# AGENT INSTRUCTIONS
# ─────────────────────────────────────────────────────────────────────────────

ANALYZER_INSTRUCTION = """\
You are a technical research interpreter specialising in computational \
machine-learning papers. Your task: read the attached PDF and produce a \
precise technical blueprint of its contents.

Return a single JSON object — no markdown fences, no extra text — with \
EXACTLY these fields:

{
  "title": "Full paper title",
  "authors": "Comma-separated author names",
  "abstract_summary": "3-sentence plain-English summary",
  "core_problem": "The fundamental challenge addressed (2-3 sentences, no jargon)",
  "central_innovation": "The single key idea or mechanism in one sentence",
  "algorithms": [
    {
      "name": "Algorithm name",
      "role": "How it fits in the overall system",
      "mechanism": "Ordered, detailed description — include every math op and loss term",
      "inputs": ["input: type / shape"],
      "outputs": ["output: type / shape"],
      "equations": ["LaTeX or descriptive equations"],
      "architecture": "Layer stack, hidden dims, attention type, positional encoding, etc."
    }
  ],
  "competing_methods": [
    {
      "name": "Method name",
      "approach": "How it works and its training objective"
    }
  ],
  "performance_metrics": ["metric name with formula if stated"],
  "mathematical_core": ["All key equations, precisely stated"],
  "network_blueprint": {
    "family": "Transformer / CNN / RNN / GNN / etc.",
    "components": ["layer types used"],
    "scale": "hidden dims, num heads, num layers as written in the paper",
    "novelties": "Any non-standard design choices"
  },
  "data": {
    "source": "Dataset name or 'synthetic'",
    "description": "Shape and nature of the data",
    "transforms": "Preprocessing steps"
  },
  "research_domain": "Primary field in 3-5 words",
  "contributions": ["Specific contribution in 5-8 words"]
}

Be exhaustive — extract every equation, every layer detail, every training trick.
Output ONLY the raw JSON object.
"""

ARCHITECT_INSTRUCTION = """\
You are a minimal-implementation architect. Your job: given the paper \
analysis that precedes this message in the conversation, design the \
smallest faithful implementation that preserves the paper's core ideas \
and runs comfortably on a CPU in under 5 minutes.

Return a single JSON object — no fences, no extra text — with this structure:

{
  "notebook_title": "Descriptive title for the implementation notebook",
  "architecture": {
    "family": "Transformer / CNN / etc.",
    "embed_dim": 64,
    "depth": 2,
    "heads": 4,
    "vocab_size": 512,
    "seq_len": 32,
    "extras": {}
  },
  "toy_data": {
    "description": "What synthetic data to use and why it exercises the key mechanism",
    "train_samples": 400,
    "val_samples": 100,
    "generation": "Exact procedural recipe — no black boxes"
  },
  "training": {
    "epochs": 10,
    "batch": 16,
    "lr": 0.001,
    "optimizer": "Adam",
    "loss": "CrossEntropyLoss or custom loss name + formula"
  },
  "models_to_implement": [
    {
      "name": "BaselineModel",
      "represents": "Which competing method",
      "summary": "Layer-by-layer description"
    },
    {
      "name": "PaperModel",
      "represents": "The paper's proposed contribution",
      "summary": "Layer-by-layer description highlighting the novel parts"
    }
  ],
  "plots": [
    {
      "kind": "line",
      "title": "Training Loss Curves",
      "content": "Loss per epoch for each model"
    },
    {
      "kind": "bar",
      "title": "Final Performance Comparison",
      "content": "Side-by-side metric comparison"
    }
  ],
  "simplifications": "What was scaled down and why the core insight still holds"
}

Output ONLY the raw JSON object.
"""

AUTHOR_INSTRUCTION = """\
You are a pedagogical code author. You write Jupyter notebooks that make \
complex ML research tangible through clear, fully-runnable PyTorch code.

The paper analysis and implementation design from the earlier steps are \
in the conversation history. Using that context, write a complete notebook.

Return a JSON array of cell objects — no fences, no extra text. Each cell:
  {"cell_type": "code" | "markdown", "source": "<complete cell content>"}

Produce cells for these 12 sections (multiple cells per section as needed):

 1. TITLE BLOCK       (markdown) — Paper title, authors, a concise abstract block,
                                    and a bold "Key Insight" callout.
 2. INTUITION         (markdown) — Explain the problem with a concrete real-world
                                    analogy. Zero jargon.
 3. ENVIRONMENT SETUP (code)     — All imports, random seeds, device detection,
                                    print library versions and device info.
 4. DATA PIPELINE     (code + markdown) — Dataset class, DataLoaders, a sample
                                    visualisation or print of a few examples.
 5. MODEL COMPONENTS  (code + markdown) — Shared building blocks
                                    (custom layers, attention heads, etc.).
 6. BASELINE MODEL    (code + markdown) — Competing method as nn.Module with
                                    docstring explaining what it represents.
 7. PAPER MODEL       (code + markdown) — Proposed method as nn.Module; explain
                                    each novel architectural choice in comments.
 8. TRAINING LOOP     (code)     — Loss function definition, train_epoch and
                                    eval_epoch functions with per-step logging.
 9. FULL EXPERIMENT   (code + markdown) — Instantiate both models, train for
                                    N epochs, collect per-epoch train/val metrics.
10. INFERENCE         (code + markdown) — Run a batch through both trained models,
                                    print or display predictions and ground truth.
11. VISUALISATIONS    (code)     — Training-loss curves, performance comparison
                                    bar chart, and any paper-specific figures.
12. REFLECTION        (markdown) — Summary of what we demonstrated, where we
                                    simplified, and 3 concrete next-step ideas.

Hard rules:
  • Every variable defined before first use.
  • ALL imports collected in section 3 only.
  • Real nn.Module subclasses — no lambda hacks.
  • Verbose print() calls showing intermediate shapes and values.
  • Comments on non-obvious lines.
  • Zero TODO / pass / ... in functional code.
  • CPU-runnable with the small data sizes from the design plan.

Output ONLY the raw JSON array.
"""

REVIEWER_INSTRUCTION = """\
You are a Python runtime inspector. Your job: mentally execute the notebook \
cells provided in the conversation history in sequence and fix every issue \
you find before a human runs them.

Check for:
  1. Undefined variables or names — trace every usage back to its definition.
  2. Missing imports — every library must be imported in the imports cell.
  3. Syntax errors — valid Python 3.9+ syntax throughout.
  4. Shape or type mismatches in PyTorch operations.
  5. Broken execution order — cells must be runnable top-to-bottom.
  6. Incomplete stubs — any function body reduced to pass or ... must be
     fully implemented.
  7. Hardcoded paths or external downloads that would fail offline.

Return the corrected cells as a JSON array — no fences, no extra text:
  [{"cell_type": "code" | "markdown", "source": "corrected content"}, ...]

If a cell is already correct, return it unchanged.
Output ONLY the raw JSON array.
"""


# ─────────────────────────────────────────────────────────────────────────────
# AGENT FACTORIES  (always call, never pass function reference)
# ─────────────────────────────────────────────────────────────────────────────

def create_paper_analyzer() -> Agent:
    return Agent(
        name="paper_analyzer",
        model="gemini-2.5-pro",
        instruction=ANALYZER_INSTRUCTION,
        output_key="analysis",
        generate_content_config=genai_types.GenerateContentConfig(
            max_output_tokens=8192,
            temperature=0.3,
        ),
    )


def create_design_architect() -> Agent:
    return Agent(
        name="design_architect",
        model="gemini-2.5-pro",
        instruction=ARCHITECT_INSTRUCTION,
        output_key="design",
        generate_content_config=genai_types.GenerateContentConfig(
            max_output_tokens=8192,
            temperature=0.4,
        ),
    )


def create_notebook_author() -> Agent:
    return Agent(
        name="notebook_author",
        model="gemini-2.5-pro",
        instruction=AUTHOR_INSTRUCTION,
        output_key="raw_cells",
        generate_content_config=genai_types.GenerateContentConfig(
            max_output_tokens=65536,
            temperature=0.5,
        ),
    )


def create_code_reviewer() -> Agent:
    return Agent(
        name="code_reviewer",
        model="gemini-2.5-pro",
        instruction=REVIEWER_INSTRUCTION,
        output_key="final_cells",
        # Only needs the raw_cells from state, not the full PDF history
        include_contents="none",
        generate_content_config=genai_types.GenerateContentConfig(
            max_output_tokens=65536,
            temperature=0.2,
        ),
    )


def create_pipeline() -> SequentialAgent:
    """Create a fresh SequentialAgent pipeline instance."""
    return SequentialAgent(
        name="paper2pytorch_pipeline",
        sub_agents=[
            create_paper_analyzer(),
            create_design_architect(),
            create_notebook_author(),
            create_code_reviewer(),
        ],
    )


# Step metadata for SSE progress reporting
PIPELINE_STEPS: dict[str, tuple[int, str, str]] = {
    "paper_analyzer":   (1, "Analyzing Paper",           "Extracting structure, algorithms, and equations…"),
    "design_architect": (2, "Designing Implementation",  "Planning toy architecture and training config…"),
    "notebook_author":  (3, "Authoring Notebook",        "Writing PyTorch code and explanations…"),
    "code_reviewer":    (4, "Reviewing & Repairing",     "Checking for errors and fixing broken references…"),
}
