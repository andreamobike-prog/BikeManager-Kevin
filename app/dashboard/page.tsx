"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

type DashboardStats = {
  products: number;
  lowStock: number;
  openOrders: number;
  workingOrders: number;
  todayMovements: number;
  inventoryBikes: number;
  customers: number;
  outOfStock: number;
};

type RecentOrder = {
  id: string;
  status: string | null;
  created_at: string | null;
  customers?: {
    name?: string | null;
  } | null;
  bikes?: {
    brand?: string | null;
    model?: string | null;
  } | null;
};

type RecentMovement = {
  id: string;
  type: string | null;
  quantity: number | null;
  created_at: string | null;
  products?: {
    title?: string | null;
  } | null;
};

export default function Dashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [screenWidth, setScreenWidth] = useState(1200);

  const [stats, setStats] = useState<DashboardStats>({
    products: 0,
    lowStock: 0,
    openOrders: 0,
    workingOrders: 0,
    todayMovements: 0,
    inventoryBikes: 0,
    customers: 0,
    outOfStock: 0,
  });

  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentMovements, setRecentMovements] = useState<RecentMovement[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    function handleResize() {
      setScreenWidth(window.innerWidth);
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  async function loadDashboard() {
    setLoading(true);

    const today = new Date().toISOString().slice(0, 10);

    const [
      { data: productsData, error: productsError },
      { data: inventoryBikesData, error: inventoryBikesError },
      { data: ordersData, error: ordersError },
      { data: movementsData, error: movementsError },
      { data: recentOrdersData, error: recentOrdersError },
      { data: recentMovementsData, error: recentMovementsError },
      { data: customersData, error: customersError },
    ] = await Promise.all([
      supabase.from("products").select("id,warehouse_qty"),
      supabase.from("inventory_bikes").select("id,current_value"),
      supabase.from("work_orders").select("id,status"),
      supabase.from("inventory_movements").select("id,created_at"),
      supabase
        .from("work_orders")
        .select(
          `
          id,
          status,
          created_at,
          customers(name),
          bikes(brand,model)
        `
        )
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("inventory_movements")
        .select(
          `
          id,
          type,
          quantity,
          created_at,
          products(title)
        `
        )
        .order("created_at", { ascending: false })
        .limit(6),
      supabase.from("customers").select("id"),
    ]);

    if (productsError) console.error(productsError);
    if (inventoryBikesError) console.error(inventoryBikesError);
    if (ordersError) console.error(ordersError);
    if (movementsError) console.error(movementsError);
    if (recentOrdersError) console.error(recentOrdersError);
    if (recentMovementsError) console.error(recentMovementsError);
    if (customersError) console.error(customersError);

    const products = productsData || [];
    const inventoryBikes = inventoryBikesData || [];
    const orders = ordersData || [];
    const movements = movementsData || [];
    const customers = customersData || [];

    const totalProducts = products.length;
    const lowStock = products.filter(
      (p: any) =>
        Number(p.warehouse_qty || 0) > 0 && Number(p.warehouse_qty || 0) <= 2
    ).length;
    const outOfStock = products.filter(
      (p: any) => Number(p.warehouse_qty || 0) <= 0
    ).length;
    const totalInventoryBikes = inventoryBikes.length;

    const openOrders = orders.filter((o: any) => o.status === "open").length;
    const workingOrders = orders.filter(
      (o: any) => o.status === "working"
    ).length;

    const todayMovements = movements.filter((m: any) => {
      if (!m.created_at) return false;
      return new Date(m.created_at).toISOString().slice(0, 10) === today;
    }).length;

    setRecentOrders((recentOrdersData as RecentOrder[]) || []);
    setRecentMovements((recentMovementsData as RecentMovement[]) || []);

    setStats({
      products: totalProducts,
      lowStock,
      openOrders,
      workingOrders,
      todayMovements,
      inventoryBikes: totalInventoryBikes,
      customers: customers.length,
      outOfStock,
    });

    setLoading(false);
  }

  const urgentCards = useMemo(() => {
    return [
      {
        title: "Schede in lavorazione",
        value: stats.workingOrders,
        description: "Lavori attivi da seguire subito",
        color: "#f59e0b",
        bg: "#fff7ed",
        border: "#fed7aa",
        link: "/workorders",
      },
      {
        title: "Prodotti sotto scorta",
        value: stats.lowStock,
        description: "Articoli con quantità bassa",
        color: "#ea580c",
        bg: "#fff7ed",
        border: "#fdba74",
        link: "/inventory",
      },
      {
        title: "Prodotti esauriti",
        value: stats.outOfStock,
        description: "Articoli da ricaricare",
        color: "#dc2626",
        bg: "#fff1f2",
        border: "#fecdd3",
        link: "/inventory",
      },
      {
        title: "Movimenti di oggi",
        value: stats.todayMovements,
        description: "Attività registrate oggi",
        color: "#2563eb",
        bg: "#eff6ff",
        border: "#bfdbfe",
        link: "/movements",
      },
    ];
  }, [stats]);

  function go(path: string) {
    router.push(path);
  }

  function formatStatus(status: string | null) {
    if (status === "open") return "Aperta";
    if (status === "working") return "In lavorazione";
    if (status === "closed") return "Chiusa";
    return status || "-";
  }

  function statusStyle(status: string | null): React.CSSProperties {
    if (status === "open") {
      return {
        background: "#e0f2fe",
        color: "#075985",
      };
    }

    if (status === "working") {
      return {
        background: "#fff7ed",
        color: "#c2410c",
      };
    }

    if (status === "closed") {
      return {
        background: "#e5e7eb",
        color: "#374151",
      };
    }

    return {
      background: "#f3f4f6",
      color: "#374151",
    };
  }

  function movementStyle(type: string | null): React.CSSProperties {
    if (type === "carico") {
      return {
        background: "#dbeafe",
        color: "#1d4ed8",
      };
    }

    if (type === "officina") {
      return {
        background: "#ffedd5",
        color: "#c2410c",
      };
    }

    if (type === "scarico") {
      return {
        background: "#fee2e2",
        color: "#b91c1c",
      };
    }

    if (type === "recupero_bici") {
      return {
        background: "#dcfce7",
        color: "#166534",
      };
    }

    return {
      background: "#e5e7eb",
      color: "#374151",
    };
  }

  const isMobile = screenWidth < 768;
  const isTablet = screenWidth >= 768 && screenWidth < 1100;

  const page: React.CSSProperties = {
    padding: isMobile ? 12 : 28,
    background: "#f8fafc",
    minHeight: "100vh",
    boxSizing: "border-box",
  };

  const hero: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: isMobile ? "stretch" : "flex-start",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 20,
    flexDirection: isMobile ? "column" : "row",
  };

  const eyebrow: React.CSSProperties = {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 8,
  };

  const title: React.CSSProperties = {
    margin: 0,
    fontSize: isMobile ? 28 : 36,
    fontWeight: 800,
    color: "#0f172a",
    lineHeight: 1.15,
  };

  const subtitle: React.CSSProperties = {
    marginTop: 8,
    color: "#64748b",
    fontSize: isMobile ? 14 : 15,
    lineHeight: 1.45,
  };

  const heroActions: React.CSSProperties = {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    width: isMobile ? "100%" : "auto",
    flexDirection: isMobile ? "column" : "row",
  };

  const primaryBtn: React.CSSProperties = {
    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
    color: "#fff",
    border: "none",
    padding: "12px 18px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 700,
    boxShadow: "0 12px 24px rgba(37,99,235,0.2)",
    width: isMobile ? "100%" : "auto",
  };

  const secondaryBtn: React.CSSProperties = {
    background: "#fff",
    color: "#0f172a",
    border: "1px solid #dbe2ea",
    padding: "12px 18px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 700,
    width: isMobile ? "100%" : "auto",
  };

  const statsGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: isMobile
      ? "1fr"
      : "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
    marginBottom: 18,
  };

  const statCard: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: isMobile ? 16 : 20,
    boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
  };

  const statTitle: React.CSSProperties = {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 8,
  };

  const statValue: React.CSSProperties = {
    fontSize: isMobile ? 28 : 32,
    fontWeight: 800,
    color: "#0f172a",
  };

  const statSubtitle: React.CSSProperties = {
    marginTop: 6,
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 1.4,
  };

  const urgentGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: isMobile
      ? "1fr"
      : "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 14,
    marginBottom: 22,
  };

  const urgentCard: React.CSSProperties = {
    borderRadius: 18,
    padding: 18,
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
  };

  const urgentTop: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  };

  const urgentTitle: React.CSSProperties = {
    fontWeight: 800,
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 1.35,
  };

  const urgentValue: React.CSSProperties = {
    fontSize: isMobile ? 24 : 28,
    fontWeight: 800,
  };

  const urgentDescription: React.CSSProperties = {
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.45,
  };

  const quickSection: React.CSSProperties = {
    marginBottom: 22,
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: isMobile ? 18 : 20,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 14,
  };

  const quickGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: isMobile
      ? "1fr"
      : "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  };

  const quickCard: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 18,
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
    width: "100%",
  };

  const quickEmoji: React.CSSProperties = {
    fontSize: 24,
    marginBottom: 10,
  };

  const quickTitle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 6,
  };

  const quickDescription: React.CSSProperties = {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.45,
  };

  const contentGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: isTablet || isMobile ? "1fr" : "1fr 1fr",
    gap: 18,
    marginBottom: 22,
  };

  const bottomGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: isTablet || isMobile ? "1fr" : "1fr 1fr",
    gap: 18,
  };

  const panel: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: isMobile ? 16 : 20,
    boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
    minWidth: 0,
  };

  const panelHeader: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: isMobile ? "stretch" : "flex-start",
    gap: 12,
    marginBottom: 14,
    flexDirection: isMobile ? "column" : "row",
  };

  const panelTitle: React.CSSProperties = {
    margin: 0,
    fontSize: isMobile ? 18 : 20,
    color: "#0f172a",
    lineHeight: 1.2,
  };

  const panelSubtitle: React.CSSProperties = {
    marginTop: 6,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
  };

  const linkBtn: React.CSSProperties = {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    padding: "8px 12px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
    width: isMobile ? "100%" : "auto",
  };

  const list: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };

  const listRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: isMobile ? "stretch" : "center",
    gap: 12,
    padding: "14px 0",
    borderBottom: "1px solid #eef2f7",
    flexDirection: isMobile ? "column" : "row",
  };

  const listLeft: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  };

  const rowTitle: React.CSSProperties = {
    fontWeight: 700,
    color: "#0f172a",
    lineHeight: 1.35,
    wordBreak: "break-word",
  };

  const rowSub: React.CSSProperties = {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.4,
    wordBreak: "break-word",
  };

  const rowMeta: React.CSSProperties = {
    fontSize: 12,
    color: "#94a3b8",
  };

  const listRight: React.CSSProperties = {
    display: "flex",
    flexDirection: isMobile ? "row" : "column",
    gap: 8,
    alignItems: isMobile ? "center" : "flex-end",
    flexWrap: "wrap",
  };

  const statusBadge: React.CSSProperties = {
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
  };

  const smallActionBtn: React.CSSProperties = {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    padding: "8px 12px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
    whiteSpace: "nowrap",
  };

  const emptyState: React.CSSProperties = {
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 16,
    padding: 24,
    textAlign: "center",
    color: "#64748b",
  };

  const checkList: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };

  const checkItem: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    gap: 12,
  };

  const checkLabel: React.CSSProperties = {
    color: "#0f172a",
    fontWeight: 600,
    textAlign: "left",
    lineHeight: 1.35,
  };

  const checkValue: React.CSSProperties = {
    color: "#2563eb",
    fontWeight: 800,
    fontSize: 18,
    whiteSpace: "nowrap",
  };

  const flowGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
    gap: 10,
  };

  const flowBtn: React.CSSProperties = {
    background: "#f8fafc",
    border: "1px solid #dbe2ea",
    padding: "14px 16px",
    borderRadius: 12,
    cursor: "pointer",
    textAlign: "left",
    fontWeight: 700,
    color: "#0f172a",
    width: "100%",
  };

  if (loading) {
    return <div style={{ padding: 24 }}>Caricamento dashboard...</div>;
  }

  return (
    <div style={page}>
      <div style={hero}>
        <div>
          <div style={eyebrow}>Pannello operativo</div>
          <h1 style={title}>Dashboard</h1>
          <p style={subtitle}>
            Panoramica immediata di officina, magazzino, clienti e bici
            aziendali.
          </p>
        </div>

        <div style={heroActions}>
          <button style={primaryBtn} onClick={() => go("/workorders/new")}>
            + Nuova scheda lavoro
          </button>
          <button style={secondaryBtn} onClick={() => go("/inventory/new")}>
            + Nuovo articolo
          </button>
        </div>
      </div>

      <div style={statsGrid}>
        <MainStat
          title="Prodotti magazzino"
          value={stats.products}
          subtitle="Articoli anagrafati"
          onClick={() => go("/inventory")}
          style={statCard}
          titleStyle={statTitle}
          valueStyle={statValue}
          subtitleStyle={statSubtitle}
        />
        <MainStat
          title="Clienti"
          value={stats.customers}
          subtitle="Anagrafiche registrate"
          onClick={() => go("/customers")}
          style={statCard}
          titleStyle={statTitle}
          valueStyle={statValue}
          subtitleStyle={statSubtitle}
        />
        <MainStat
          title="Schede aperte"
          value={stats.openOrders}
          subtitle="Da prendere in carico"
          onClick={() => go("/workorders")}
          style={statCard}
          titleStyle={statTitle}
          valueStyle={statValue}
          subtitleStyle={statSubtitle}
        />
        <MainStat
          title="Bici magazzino"
          value={stats.inventoryBikes}
          subtitle="Asset aziendali disponibili"
          onClick={() => go("/inventory-bikes")}
          style={statCard}
          titleStyle={statTitle}
          valueStyle={statValue}
          subtitleStyle={statSubtitle}
        />
      </div>

      <div style={urgentGrid}>
        {urgentCards.map((card) => (
          <button
            key={card.title}
            onClick={() => go(card.link)}
            style={{
              ...urgentCard,
              background: card.bg,
              border: `1px solid ${card.border}`,
            }}
          >
            <div style={urgentTop}>
              <div style={urgentTitle}>{card.title}</div>
              <div style={{ ...urgentValue, color: card.color }}>{card.value}</div>
            </div>
            <div style={urgentDescription}>{card.description}</div>
          </button>
        ))}
      </div>

      <div style={quickSection}>
        <div style={sectionTitle}>Azioni rapide</div>

        <div style={quickGrid}>
          <QuickAction
            title="Magazzino"
            description="Visualizza e modifica articoli"
            emoji="📦"
            onClick={() => go("/inventory")}
            style={quickCard}
            emojiStyle={quickEmoji}
            titleStyle={quickTitle}
            descriptionStyle={quickDescription}
          />
          <QuickAction
            title="Movimenti"
            description="Controlla carichi, scarichi e officina"
            emoji="🔄"
            onClick={() => go("/movements")}
            style={quickCard}
            emojiStyle={quickEmoji}
            titleStyle={quickTitle}
            descriptionStyle={quickDescription}
          />
          <QuickAction
            title="Clienti"
            description="Apri anagrafiche e bici cliente"
            emoji="👤"
            onClick={() => go("/customers")}
            style={quickCard}
            emojiStyle={quickEmoji}
            titleStyle={quickTitle}
            descriptionStyle={quickDescription}
          />
          <QuickAction
            title="Schede officina"
            description="Accedi ai lavori aperti e chiusi"
            emoji="🔧"
            onClick={() => go("/workorders")}
            style={quickCard}
            emojiStyle={quickEmoji}
            titleStyle={quickTitle}
            descriptionStyle={quickDescription}
          />
          <QuickAction
            title="Bici magazzino"
            description="Gestisci asset e valore attuale"
            emoji="🚲"
            onClick={() => go("/inventory-bikes")}
            style={quickCard}
            emojiStyle={quickEmoji}
            titleStyle={quickTitle}
            descriptionStyle={quickDescription}
          />
          <QuickAction
            title="Smonta ricambi"
            description="Recupera componenti da bici"
            emoji="🛠"
            onClick={() => go("/bike-disassembly")}
            style={quickCard}
            emojiStyle={quickEmoji}
            titleStyle={quickTitle}
            descriptionStyle={quickDescription}
          />
          <QuickAction
            title="Monta ricambi"
            description="Installa componenti sulle bici"
            emoji="🔩"
            onClick={() => go("/install-component")}
            style={quickCard}
            emojiStyle={quickEmoji}
            titleStyle={quickTitle}
            descriptionStyle={quickDescription}
          />
        </div>
      </div>

      <div style={contentGrid}>
        <div style={panel}>
          <div style={panelHeader}>
            <div>
              <h2 style={panelTitle}>Ultime schede lavoro</h2>
              <p style={panelSubtitle}>
                Le lavorazioni più recenti da controllare.
              </p>
            </div>

            <button style={linkBtn} onClick={() => go("/workorders")}>
              Vedi tutte
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <div style={emptyState}>Nessuna scheda lavoro disponibile.</div>
          ) : (
            <div style={list}>
              {recentOrders.map((o) => (
                <div key={o.id} style={listRow}>
                  <div style={listLeft}>
                    <div style={rowTitle}>
                      {o.customers?.name || "Cliente non definito"}
                    </div>
                    <div style={rowSub}>
                      {o.bikes?.brand || "-"} {o.bikes?.model || ""}
                    </div>
                    <div style={rowMeta}>
                      {o.created_at
                        ? new Date(o.created_at).toLocaleDateString("it-IT")
                        : "-"}
                    </div>
                  </div>

                  <div style={listRight}>
                    <span
                      style={{
                        ...statusBadge,
                        ...statusStyle(o.status),
                      }}
                    >
                      {formatStatus(o.status)}
                    </span>

                    <button
                      style={smallActionBtn}
                      onClick={() => {
                        if (o.status === "closed") {
                          router.push(`/workorders/${o.id}/report`);
                        } else {
                          router.push(`/workorders/${o.id}`);
                        }
                      }}
                    >
                      Apri
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={panel}>
          <div style={panelHeader}>
            <div>
              <h2 style={panelTitle}>Ultimi movimenti</h2>
              <p style={panelSubtitle}>
                Le ultime attività di magazzino registrate.
              </p>
            </div>

            <button style={linkBtn} onClick={() => go("/movements")}>
              Vedi tutti
            </button>
          </div>

          {recentMovements.length === 0 ? (
            <div style={emptyState}>Nessun movimento disponibile.</div>
          ) : (
            <div style={list}>
              {recentMovements.map((m) => (
                <div key={m.id} style={listRow}>
                  <div style={listLeft}>
                    <div style={rowTitle}>
                      {m.products?.title || "Prodotto non trovato"}
                    </div>
                    <div style={rowSub}>Quantità: {m.quantity ?? 0}</div>
                    <div style={rowMeta}>
                      {m.created_at
                        ? new Date(m.created_at).toLocaleDateString("it-IT")
                        : "-"}
                    </div>
                  </div>

                  <div style={listRight}>
                    <span
                      style={{
                        ...statusBadge,
                        ...movementStyle(m.type),
                      }}
                    >
                      {m.type || "-"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={bottomGrid}>
        <div style={panel}>
          <div style={panelHeader}>
            <div>
              <h2 style={panelTitle}>Controllo operativo rapido</h2>
              <p style={panelSubtitle}>
                Le aree su cui intervenire più spesso durante la giornata.
              </p>
            </div>
          </div>

          <div style={checkList}>
            <ChecklistItem
              label="Articoli sotto scorta"
              value={stats.lowStock}
              onClick={() => go("/inventory")}
              style={checkItem}
              labelStyle={checkLabel}
              valueStyle={checkValue}
            />
            <ChecklistItem
              label="Articoli esauriti"
              value={stats.outOfStock}
              onClick={() => go("/inventory")}
              style={checkItem}
              labelStyle={checkLabel}
              valueStyle={checkValue}
            />
            <ChecklistItem
              label="Schede aperte"
              value={stats.openOrders}
              onClick={() => go("/workorders")}
              style={checkItem}
              labelStyle={checkLabel}
              valueStyle={checkValue}
            />
            <ChecklistItem
              label="Schede in lavorazione"
              value={stats.workingOrders}
              onClick={() => go("/workorders")}
              style={checkItem}
              labelStyle={checkLabel}
              valueStyle={checkValue}
            />
            <ChecklistItem
              label="Movimenti registrati oggi"
              value={stats.todayMovements}
              onClick={() => go("/movements")}
              style={checkItem}
              labelStyle={checkLabel}
              valueStyle={checkValue}
            />
          </div>
        </div>

        <div style={panel}>
          <div style={panelHeader}>
            <div>
              <h2 style={panelTitle}>Flussi veloci</h2>
              <p style={panelSubtitle}>
                Accessi immediati alle operazioni ricorrenti.
              </p>
            </div>
          </div>

          <div style={flowGrid}>
            <FlowButton
              title="Nuovo cliente"
              onClick={() => go("/customers")}
              style={flowBtn}
            />
            <FlowButton
              title="Nuova bici magazzino"
              onClick={() => go("/inventory-bikes")}
              style={flowBtn}
            />
            <FlowButton
              title="Nuovo movimento"
              onClick={() => go("/movements")}
              style={flowBtn}
            />
            <FlowButton
              title="Controlla sotto scorta"
              onClick={() => go("/inventory")}
              style={flowBtn}
            />
            <FlowButton
              title="Apri ultime schede"
              onClick={() => go("/workorders")}
              style={flowBtn}
            />
            <FlowButton
              title="Gestisci ricambi bici"
              onClick={() => go("/bike-disassembly")}
              style={flowBtn}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MainStat({
  title,
  value,
  subtitle,
  onClick,
  style,
  titleStyle,
  valueStyle,
  subtitleStyle,
}: {
  title: string;
  value: number;
  subtitle: string;
  onClick: () => void;
  style: React.CSSProperties;
  titleStyle: React.CSSProperties;
  valueStyle: React.CSSProperties;
  subtitleStyle: React.CSSProperties;
}) {
  return (
    <button style={style} onClick={onClick}>
      <div style={titleStyle}>{title}</div>
      <div style={valueStyle}>{value}</div>
      <div style={subtitleStyle}>{subtitle}</div>
    </button>
  );
}

function QuickAction({
  title,
  description,
  emoji,
  onClick,
  style,
  emojiStyle,
  titleStyle,
  descriptionStyle,
}: {
  title: string;
  description: string;
  emoji: string;
  onClick: () => void;
  style: React.CSSProperties;
  emojiStyle: React.CSSProperties;
  titleStyle: React.CSSProperties;
  descriptionStyle: React.CSSProperties;
}) {
  return (
    <button style={style} onClick={onClick}>
      <div style={emojiStyle}>{emoji}</div>
      <div style={titleStyle}>{title}</div>
      <div style={descriptionStyle}>{description}</div>
    </button>
  );
}

function ChecklistItem({
  label,
  value,
  onClick,
  style,
  labelStyle,
  valueStyle,
}: {
  label: string;
  value: number;
  onClick: () => void;
  style: React.CSSProperties;
  labelStyle: React.CSSProperties;
  valueStyle: React.CSSProperties;
}) {
  return (
    <button style={style} onClick={onClick}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{value}</span>
    </button>
  );
}

function FlowButton({
  title,
  onClick,
  style,
}: {
  title: string;
  onClick: () => void;
  style: React.CSSProperties;
}) {
  return (
    <button style={style} onClick={onClick}>
      {title}
    </button>
  );
}