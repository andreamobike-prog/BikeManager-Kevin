"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isLoginPage = pathname === "/login";

  const layout: React.CSSProperties = {
    display: "flex",
    minHeight: "100vh",
    background: "#f6f8fb",
    color: "#1f2937",
    fontFamily: "Inter, system-ui",
  };

  const sidebar: React.CSSProperties = {
    width: 240,
    background: "#ffffff",
    padding: 20,
    borderRight: "1px solid #e5e7eb",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };

  const logo: React.CSSProperties = {
    marginBottom: 18,
    textAlign: "center",
  };

  const menu: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  };

  const menuButton: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 8,
    textDecoration: "none",
    color: "#374151",
    fontWeight: 500,
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    transition: "all 0.15s",
  };

  const page: React.CSSProperties = {
    flex: 1,
    padding: 40,
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div style={layout}>
      <aside style={sidebar}>
        <div style={logo}>
          <img src="/bigalogo.png" alt="Biga" style={{ width: 130 }} />
        </div>

        <nav style={menu}>
          <Link href="/" style={menuButton}>
            🏠 Dashboard
          </Link>

          <Link href="/inventory" style={menuButton}>
            📦 Magazzino
          </Link>

          <Link href="/movements" style={menuButton}>
            🔄 Movimenti
          </Link>

          <Link href="/customers" style={menuButton}>
            👤 Clienti
          </Link>

          <Link href="/workorders" style={menuButton}>
            🔧 Schede officina
          </Link>

          <Link href="/inventory-bikes" style={menuButton}>
            🚲 Bici magazzino
          </Link>

          <Link href="/bike-disassembly" style={menuButton}>
            🛠 Smonta ricambi bici
          </Link>

          <Link href="/install-component" style={menuButton}>
            🔩 Monta ricambi su bici
          </Link>
        </nav>

        <LogoutButton />
      </aside>

      <main style={page}>{children}</main>
    </div>
  );
}