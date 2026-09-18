import type { ReactNode } from "react";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata = { title: "EDU RAG" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <Sidebar />
          <main style={{ flex: 1, padding: 32, maxWidth: 1280, width: "100%", margin: "0 auto" }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
