import { NextResponse } from "next/server";

interface HFPaper {
  paper: {
    id: string;
    title: string;
    summary?: string;
    authors?: { name: string }[];
    upvotes?: number;
  };
}

const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 15 * 60 * 1000; // 15 minutes

export async function GET() {
  const cached = cache.get("trending");
  if (cached && Date.now() - cached.ts < TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const resp = await fetch("https://huggingface.co/api/daily_papers?limit=10", {
      headers: { "User-Agent": "Paper2PyTorch/1.0" },
    });
    const raw: HFPaper[] = await resp.json();

    const papers = raw.map((item) => ({
      id: item.paper.id,
      title: item.paper.title,
      abstract: item.paper.summary ?? "",
      authors: (item.paper.authors ?? []).map((a) => a.name).join(", "),
      upvotes: item.paper.upvotes ?? 0,
      url: `https://arxiv.org/abs/${item.paper.id}`,
    }));

    cache.set("trending", { data: papers, ts: Date.now() });
    return NextResponse.json(papers);
  } catch {
    return NextResponse.json({ error: "Failed to fetch trending papers" }, { status: 500 });
  }
}
