"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  Package,
  ArrowLeftRight,
  Users,
  Building2,
  Wrench,
  UserRound,
  Archive,
  type LucideIcon,
} from "lucide-react";


type DashboardStats = {
  productsCount: number;
  customersCount: number;
  openWorkOrdersCount: number;
  inProgressWorkOrdersCount: number;
  closedWorkOrdersCount: number;
  warehouseValue: number;
};

const CLARA_EMAIL = "clara.barilli@gmail.com";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("Utente");
  const [stats, setStats] = useState<DashboardStats>({
    productsCount: 0,
    customersCount: 0,
    openWorkOrdersCount: 0,
    inProgressWorkOrdersCount: 0,
    closedWorkOrdersCount: 0,
    warehouseValue: 0,
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);

    const [
      { data: authData },
      productsRes,
      customersRes,
      openWorkOrdersRes,
      inProgressWorkOrdersRes,
      closedWorkOrdersRes,
    ] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("products")
        .select("id, warehouse_qty, price_b2b", { count: "exact" }),
      supabase
        .from("customers")
        .select("id", { count: "exact" }),
      supabase
        .from("work_orders")
        .select("id", { count: "exact" })
        .eq("status", "open")
        .or("archived.is.null,archived.eq.false"),
      supabase
        .from("work_orders")
        .select("id", { count: "exact" })
        .eq("status", "working")
        .or("archived.is.null,archived.eq.false"),
      supabase
        .from("work_orders")
        .select("id", { count: "exact" })
        .eq("status", "closed")
        .or("archived.is.null,archived.eq.false"),
    ]);

    const email = authData.user?.email || "";
    const rawName =
      authData.user?.user_metadata?.name ||
      authData.user?.user_metadata?.full_name ||
      email.split("@")[0] ||
      "Utente";

    setUserEmail(email);
    setUserName(formatDisplayName(rawName));

    const products = productsRes.data || [];

    const warehouseValue = products.reduce((sum: number, item: any) => {
      const qty = Number(item.warehouse_qty || 0);
      const price = Number(item.price_b2b || 0);
      return sum + qty * price;
    }, 0);

    setStats({
      productsCount: productsRes.count || 0,
      customersCount: customersRes.count || 0,
      openWorkOrdersCount: openWorkOrdersRes.count || 0,
      inProgressWorkOrdersCount: inProgressWorkOrdersRes.count || 0,
      closedWorkOrdersCount: closedWorkOrdersRes.count || 0,
      warehouseValue,
    });

    setLoading(false);
  }

  if (loading) {
    return <div className="dashboard-loading">Caricamento dashboard...</div>;
  }

  return <StandardDashboard userName={userName} stats={stats} />;
}

function StandardDashboard({
  userName,
  stats,
}: {
  userName: string;
  stats: DashboardStats;
}) {
  return (
    <div className="app-page-shell dashboard-page-shell">
      <div className="page-header dashboard-header">
        <div className="page-header__left">
          <div className="apple-kicker">Pannello operativo</div>
          <h1 className="apple-page-title">Dashboard</h1>
          <p className="apple-page-subtitle">
            Ecco la panoramica rapida di officina, magazzino, clienti e bici aziendali.
          </p>

          <div className="dashboard-operator-line">
            <UserRound size={22} strokeWidth={2} />
            <span>Buon pomeriggio {userName}</span>
          </div>

        </div>

        <div className="page-header__right">
          <Link href="/workorders/new">
            <button className="btn-primary">+ Nuova scheda lavoro</button>
          </Link>

          <Link href="/inventory/new">
            <button className="btn-secondary dashboard-btn-accent">+ Nuovo articolo</button>
          </Link>
        </div>
      </div>

      <div className="dashboard-stats-grid-six">
        <MetricCard
          label="Clienti"
          value={String(stats.customersCount)}
          sub="Anagrafiche registrate"
        />
        <MetricCard
          label="Prodotti magazzino"
          value={String(stats.productsCount)}
          sub="Articoli anagrafati"
        />
        <MetricCard
          label="Valore Magazzino"
          value={formatCurrency(stats.warehouseValue)}
          sub="Valore complessivo articoli"
        />
        <MetricCard
          label="Schede lavoro aperte"
          value={String(stats.openWorkOrdersCount)}
          sub="Pronte per presa in carico"
        />
        <MetricCard
          label="Schede in lavorazione"
          value={String(stats.inProgressWorkOrdersCount)}
          sub="Interventi attualmente in corso"
        />
        <MetricCard
          label="Schede lavoro chiuse"
          value={String(stats.closedWorkOrdersCount)}
          sub="Pronte per report / gestione"
        />
      </div>

      <h2 className="dashboard-section-title">Azioni rapide</h2>

      <div className="dashboard-quick-grid-custom">
        <QuickCard
          href="/customers"
          icon={Users}
          title="Clienti"
          description="Apri anagrafiche e bici cliente"
        />
        <QuickCard
          href="/suppliers"
          icon={Building2}
          title="Fornitori"
          description="Gestisci anagrafiche fornitori"
        />
        <QuickCard
          href="/movements"
          icon={ArrowLeftRight}
          title="Movimenti"
          description="Controlla carichi e scarichi"
        />
        <QuickCard
          href="/inventory"
          icon={Package}
          title="Magazzino"
          description="Visualizza e modifica articoli"
        />
        <QuickCard
          href="/workorders"
          icon={Wrench}
          title="Schede officina"
          description="Accedi ai lavori aperti e chiusi"
        />
        <QuickCard
          href="/workorders/archive"
          icon={Archive}
          title="Archivio schede"
          description="Stato amministrativo e report finale."
        />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="dashboard-metric-card">
      <div className="dashboard-metric-value">{value}</div>
      <div className="dashboard-metric-label">{label}</div>
      <div className="dashboard-metric-sub">{sub}</div>
    </div>
  );
}

function QuickCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="dashboard-quick-card-link">
      <div className="dashboard-quick-card">
        <div className="dashboard-quick-icon-wrap">
          <div className="dashboard-quick-icon">
            <Icon size={30} strokeWidth={2.1} />
          </div>
        </div>
        <div className="dashboard-quick-title">{title}</div>
        <div className="dashboard-quick-description">{description}</div>
      </div>
    </Link>
  );
}

function formatDisplayName(value: string) {
  if (!value) return "Utente";

  return value
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}