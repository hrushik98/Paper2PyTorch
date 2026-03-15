import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const url = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}&max_results=1`;

  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Paper2PyTorch/1.0" },
      next: { revalidate: 3600 },
    });
    const xml = await resp.text();

    const title = xml.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? "Unknown";
    const summary = xml.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim() ?? "";

    const rawAuthors = xml.match(/<name>([\s\S]*?)<\/name>/g) ?? [];
    const authors = rawAuthors
      .map((a) => a.replace(/<\/?name>/g, "").trim())
      .join(", ");

    return NextResponse.json({ title, authors, abstract: summary });
  } catch {
    return NextResponse.json({ error: "Failed to fetch arXiv metadata" }, { status: 500 });
  }
}
