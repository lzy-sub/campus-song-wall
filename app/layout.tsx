import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "校园点歌墙",
  description: "凛光新手任务示例项目",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f6f4ef" }}>
        {children}
      </body>
    </html>
  );
}