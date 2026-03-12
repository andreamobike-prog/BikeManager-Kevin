"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "./LogoutButton";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 900);
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const layout: React.CSSProperties = {
    display: "flex",
    minHeight: "100vh",
    background: "#f6f8fb",
    color: "#1f2937",
    fontFamily: "Inter, system-ui",
    position: "relative",
  };

  const sidebar: React.CSSProperties = {
    width: 240,
    background: "#ffffff",
    padding: 20,
    borderRight: "1px solid #e5e7eb",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxSizing: "border-box",
  };

  const mobileSidebar: React.CSSProperties = {
    ...sidebar,
    position: "fixed",
    top: 0,
    left: 0,
    height: "100vh",
    zIndex: 1001,
    transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
    transition: "transform 0.25s ease",
    boxShadow: "0 10px 40px rgba(0,0,0,0.18)",
  };

  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.35)",
    zIndex: 1000,
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
    borderRadius: 10,
    textDecoration: "none",
    color: "#374151",
    fontWeight: 600,
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
  };

  const activeMenuButton: React.CSSProperties = {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
  };

  const pageWrap: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  };

  const mobileTopbar: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "14px 16px",
    background: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
  };

  const burgerBtn: React.CSSProperties = {
    border: "1px solid #d1d5db",
    background: "#fff",
    borderRadius: 10,
    padding: "10px 12px",
    cursor: "pointer",
    fontSize: 18,
    fontWeight: 700,
  };

  const mobileLogo: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontWeight: 800,
    color: "#0f172a",
  };

  const page: React.CSSProperties = {
    flex: 1,
    padding: isMobile ? 16 : 40,
    boxSizing: "border-box",
    minWidth: 0,
  };

  const closeBtn: React.CSSProperties = {
    border: "1px solid #d1d5db",
    background: "#fff",
    borderRadius: 10,
    padding: "8px 10px",
    cursor: "pointer",
    alignSelf: "flex-end",
    marginBottom: 6,
    fontWeight: 700,
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  function NavItem({
    href,
    icon,
    label,
  }: {
    href: string;
    icon: string;
    label: string;
  }) {
    const isActive = pathname === href;
    return (
      <Link
        href={href}
        style={{
          ...menuButton,
          ...(isActive ? activeMenuButton : {}),
        }}
      >
        <span>{icon}</span>
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <div style={layout}>
      {!isMobile && (
        <aside style={sidebar}>
          <div style={logo}>
            <img src="/bigalogo.png" alt="Biga" style={{ width: 130 }} />
          </div>

          <nav style={menu}>
            <NavItem href="/" icon="🏠" label="Dashboard" />
            <NavItem href="/inventory" icon="📦" label="Magazzino" />
            <NavItem href="/movements" icon="🔄" label="Movimenti" />
            <NavItem href="/customers" icon="👤" label="Clienti" />
            <NavItem href="/workorders" icon="🔧" label="Schede officina" />
            <NavItem href="/inventory-bikes" icon="🚲" label="Bici magazzino" />
            <NavItem
              href="/bike-disassembly"
              icon="🛠"
              label="Smonta ricambi bici"
            />
            <NavItem
              href="/install-component"
              icon="🔩"
              label="Monta ricambi su bici"
            />
          </nav>

          <LogoutButton />
        </aside>
      )}

      {isMobile && mobileOpen && <div style={overlay} onClick={() => setMobileOpen(false)} />}

      {isMobile && (
        <aside style={mobileSidebar}>
          <button style={closeBtn} onClick={() => setMobileOpen(false)}>
            ✕
          </button>

          <div style={logo}>
            <img src="/bigalogo.png" alt="Biga" style={{ width: 120 }} />
          </div>

          <nav style={menu}>
            <NavItem href="/" icon="🏠" label="Dashboard" />
            <NavItem href="/inventory" icon="📦" label="Magazzino" />
            <NavItem href="/movements" icon="🔄" label="Movimenti" />
            <NavItem href="/customers" icon="👤" label="Clienti" />
            <NavItem href="/workorders" icon="🔧" label="Schede officina" />
            <NavItem href="/inventory-bikes" icon="🚲" label="Bici magazzino" />
            <NavItem
              href="/bike-disassembly"
              icon="🛠"
              label="Smonta ricambi bici"
            />
            <NavItem
              href="/install-component"
              icon="🔩"
              label="Monta ricambi su bici"
            />
          </nav>

          <LogoutButton />
        </aside>
      )}

      <div style={pageWrap}>
        {isMobile && (
          <div style={mobileTopbar}>
            <button style={burgerBtn} onClick={() => setMobileOpen(true)}>
              ☰
            </button>

            <div style={mobileLogo}>
              <img src="/bigalogo.png" alt="Biga" style={{ width: 90 }} />
            </div>

            <div style={{ width: 44 }} />
          </div>
        )}

        <main style={page}>{children}</main>
      </div>
    </div>
  );
}