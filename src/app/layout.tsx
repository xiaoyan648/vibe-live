import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VibeLive - 浏览器氛围音乐生成器",
  description:
    "选择一种氛围，进入无限不重复的生成式音乐流。开源的浏览器 vibe music playground。",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
