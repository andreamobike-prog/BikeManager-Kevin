"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard,
  Users,
  Building2,
  Package,
  ArrowLeftRight,
  Wrench,
  LogOut,
  type LucideIcon,
} from "lucide-react";

type MenuItem = {
  href: string;
  label: string;
  sub: string;
  icon: LucideIcon;
  badge?: number;
  highlight?: boolean;
};

type MenuGroup = {
  section: string;
  items: MenuItem[];
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const menu: MenuGroup[] = useMemo(
    () => [
      {
        section: "Generale",
        items: [
          {
            href: "/dashboard",
            label: "Dashboard",
            sub: "Panoramica operativa",
            icon: LayoutDashboard,
          },
          {
            href: "/customers",
            label: "Clienti",
            sub: "Anagrafiche e bici",
            icon: Users,
          },
          {
            href: "/suppliers",
            label: "Fornitori",
            sub: "Anagrafiche fornitori",
            icon: Building2,
          },
        ],
      },
      {
        section: "Magazzino",
        items: [
          {
            href: "/inventory",
            label: "Magazzino",
            sub: "Prodotti e scorte",
            icon: Package,
          },
          {
            href: "/movements",
            label: "Movimenti",
            sub: "Carichi e scarichi",
            icon: ArrowLeftRight,
          },
        ],
      },
      {
        section: "Officina",
        items: [
          {
            href: "/workorders",
            label: "Schede officina",
            sub: "Lavori e interventi",
            icon: Wrench,
          },
        ],
      },
    ],
    []
  );

  return (
    <>
      <button
        type="button"
        className="biga-mobile-toggle"
        onClick={() => setMobileOpen((prev) => !prev)}
        aria-label="Apri menu"
      >
        {mobileOpen ? "✕" : "☰"}
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="biga-sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-label="Chiudi menu"
        />
      )}

      <aside className={`biga-sidebar ${mobileOpen ? "is-mobile-open" : ""}`}>
        <div className="biga-sidebar__inner">
          <Link href="/dashboard" className="biga-sidebar__brand">
            <div className="biga-sidebar__brand-logo-wrap">
              <img
                src="/kc-logo.png"
                alt="Gestionale Kevin"
                className="biga-sidebar__brand-logo"
              />
            </div>

            <div className="biga-sidebar__brand-content">
              <div className="biga-sidebar__brand-title">Gestionale Kevin</div>
              <div className="biga-sidebar__brand-subtitle">
                Officina e magazzino
              </div>
            </div>
          </Link>

          <div className="biga-sidebar__scroll">
            {menu.map((group) => (
              <section key={group.section} className="biga-sidebar__group">
                <div className="biga-sidebar__group-title">{group.section}</div>

                <nav className="biga-sidebar__nav">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`biga-sidebar__link ${active ? "is-active" : ""
                          } ${item.highlight ? "has-highlight" : ""}`}
                      >
                        <span className="biga-sidebar__meta">
                          <div className="biga-sidebar__text-row">
                            <div className="biga-sidebar__title-wrap">
                              <span className="biga-sidebar__icon">
                                <Icon size={18} strokeWidth={2.1} />
                              </span>

                              <span className="biga-sidebar__text">{item.label}</span>
                            </div>

                            {item.badge !== undefined && item.badge > 0 && (
                              <span className="biga-sidebar__badge">{item.badge}</span>
                            )}
                          </div>

                          <span className="biga-sidebar__sub">{item.sub}</span>
                        </span>
                      </Link>
                    );
                  })}
                </nav>
              </section>
            ))}
          </div>

          <div className="biga-sidebar__footer">
            <button
              type="button"
              onClick={handleLogout}
              className="biga-sidebar__logout"
            >
              <span className="biga-sidebar__icon">
                <LogOut size={18} strokeWidth={2.1} />
              </span>

              <span className="biga-sidebar__meta">
                <span className="biga-sidebar__text">Logout</span>
                <span className="biga-sidebar__sub">Esci dal gestionale</span>
              </span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
