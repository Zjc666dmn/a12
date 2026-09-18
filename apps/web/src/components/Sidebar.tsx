"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Boxes,
  Sparkles,
  Search,
  Server,
  Settings,
  Database,
  Network,
  Brain,
  Zap,
  Play,
  Bug,
  Sliders,
  Layers,
  BarChart3,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: any;
  section?: string;
}

const LINKS: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard, section: "" },
  { href: "/knowledge-bases", label: "Knowledge Bases", icon: BookOpen, section: "KNOWLEDGE" },
  { href: "/documents", label: "Documents", icon: FileText, section: "KNOWLEDGE" },
  { href: "/chunks", label: "Chunks", icon: Layers, section: "KNOWLEDGE" },
  { href: "/knowledge-graph", label: "Knowledge Graph", icon: Network, section: "KNOWLEDGE" },
  { href: "/search", label: "Search & RAG", icon: Search, section: "RAG" },
  { href: "/debug", label: "RAG Debug", icon: Bug, section: "RAG" },
  { href: "/models", label: "Models", icon: Server, section: "MODELS" },
  { href: "/settings", label: "Settings", icon: Settings, section: "SYSTEM" },
];

export function Sidebar() {
  const pathname = usePathname();
  let lastSection = "";

  return (
    <aside
      style={{
        width: 240,
        minWidth: 240,
        borderRight: "1px solid var(--border)",
        padding: "20px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        background: "var(--bg)",
        height: "100vh",
        position: "sticky",
        top: 0,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          padding: "0 12px 16px 12px",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}
      >
        EDU RAG
      </div>
      {LINKS.map(({ href, label, icon: Icon, section }) => {
        const showSection = section && section !== lastSection;
        if (section) lastSection = section;
        const active = pathname === href;
        return (
          <div key={href}>
            {showSection && (
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  color: "var(--muted)",
                  padding: "12px 12px 4px 12px",
                }}
              >
                {section}
              </div>
            )}
            <Link
              href={href}
              className={`sidebar-link ${active ? "active" : ""}`}
            >
              <Icon size={15} />
              {label}
            </Link>
          </div>
        );
      })}
    </aside>
  );
}
