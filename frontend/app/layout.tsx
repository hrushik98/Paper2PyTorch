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
  const themeInitializer = `
    (function () {
      try {
        var storedTheme = localStorage.getItem("theme");
        var theme = storedTheme === "light" ? "light" : "dark";
        document.documentElement.classList.remove("dark", "light");
        document.documentElement.classList.add(theme);
      } catch (e) {
        document.documentElement.classList.add("dark");
      }
    })();
  `;

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body className="min-h-screen antialiased bg-[var(--bg)] text-[var(--text)]">
        {children}
      </body>
    </html>
  );
}
