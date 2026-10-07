import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "知更 · 投资风险雷达",
  description: "把投资关注点变成可核查、可修改、持续运行的监控任务。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
