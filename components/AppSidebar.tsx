"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard,
  Users,
  Building2,
  Package,
  ArrowLeftRight,
  Bike,
  Wrench,
  ReceiptText,
  Hammer,
  Settings2,
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

  const [pendingNonBillable, setPendingNonBillable] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    loadPendingNonBillable();

    const interval = setInterval(() => {
      loadPendingNonBillable();
    }, 12000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function loadPendingNonBillable() {
    const { count, error } = await supabase
      .from("non_billable_work_order_items")
      .select("*", { count: "exact", head: true })
      .eq("handled", false);

    if (error) {
      console.error("Errore caricamento badge ricambi da gestire:", error);
      return;
    }

    setPendingNonBillable(count || 0);
  }

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
    [pendingNonBillable]
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
                alt="KC Bike Rental"
                className="biga-sidebar__brand-logo"
              />
            </div>

            <div className="biga-sidebar__brand-content">
              <div className="biga-sidebar__brand-title">Kevin Cici</div>
              <div className="biga-sidebar__brand-subtitle">
                Gestionale officina
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