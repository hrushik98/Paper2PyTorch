import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paper2PyTorch — Research Papers → Running Code",
  description:
    "Drop a research paper PDF or paste an arXiv link. Get a fully executable Jupyter notebook with PyTorch implementations in minutes, powered by Google ADK agents.",
  keywords: ["research paper", "pytorch", "jupyter notebook", "machine learning", "AI", "arxiv"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="bg-[#09090b] text-zinc-50 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
