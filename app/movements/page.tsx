"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

type Movement = {
  id: string;
  product_id: string | null;
  quantity: number | null;
  type: string | null;
  work_order_id: string | null;
  bike_id: string | null;
  created_at: string | null;
};

type Product = {
  id: string;
  title: string | null;
  ean: string | null;
};

type InventoryBike = {
  id: string;
  brand: string | null;
  model: string | null;
  frame_number?: string | null;
  color?: string | null;
  type?: string | null;
};

type WorkOrder = {
  id: string;
  customer_id: string | null;
  status: string | null;
};

type Customer = {
  id: string;
  name: string | null;
};

function MovementsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const bikeIdFromQuery = searchParams.get("bikeId") || "";

  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [bikes, setBikes] = useState<InventoryBike[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [bikeFilter, setBikeFilter] = useState(bikeIdFromQuery);
  const [bikeSearch, setBikeSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!bikeIdFromQuery) return;
    setBikeFilter(bikeIdFromQuery);
  }, [bikeIdFromQuery]);

  async function load() {
    setLoading(true);

    const [
      { data: mov, error: movError },
      { data: prod, error: prodError },
      { data: bik, error: bikError },
      { data: wo, error: woError },
      { data: cust, error: custError },
    ] = await Promise.all([
      supabase
        .from("inventory_movements")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("products").select("id,title,ean"),
      supabase
        .from("inventory_bikes")
        .select("id,brand,model,frame_number,color,type"),
      supabase.from("work_orders").select("id,customer_id,status"),
      supabase.from("customers").select("id,name"),
    ]);

    if (movError) console.error("Errore movimenti:", movError);
    if (prodError) console.error("Errore prodotti:", prodError);
    if (bikError) console.error("Errore bici:", bikError);
    if (woError) console.error("Errore work orders:", woError);
    if (custError) console.error("Errore clienti:", custError);

    setMovements((mov as Movement[]) || []);
    setProducts((prod as Product[]) || []);
    setBikes((bik as InventoryBike[]) || []);
    setWorkOrders((wo as WorkOrder[]) || []);
    setCustomers((cust as Customer[]) || []);
    setLoading(false);
  }

  function product(id: string | null) {
    return products.find((p) => p.id === id);
  }

  function bike(id: string | null) {
    return bikes.find((b) => b.id === id);
  }

  function work(id: string | null) {
    return workOrders.find((w) => w.id === id);
  }

  function customer(id: string | null | undefined) {
    return customers.find((c) => c.id === id);
  }

  const selectedBike = useMemo(() => {
    return bikes.find((b) => b.id === bikeFilter) || null;
  }, [bikes, bikeFilter]);

  const filteredBikeOptions = useMemo(() => {
    const q = bikeSearch.trim().toLowerCase();

    if (!q) return [];

    return bikes
      .filter((b) => {
        const text = [
          b.brand || "",
          b.model || "",
          b.frame_number || "",
          b.color || "",
          b.type || "",
        ]
          .join(" ")
          .toLowerCase();

        return text.includes(q);
      })
      .slice(0, 12);
  }, [bikes, bikeSearch]);

  function badgeStyle(type: string | null): React.CSSProperties {
    switch (type) {
      case "carico":
        return {
          background: "#dbeafe",
          color: "#1d4ed8",
          border: "1px solid #bfdbfe",
        };
      case "officina":
        return {
          background: "#ffedd5",
          color: "#c2410c",
          border: "1px solid #fdba74",
        };
      case "scarico":
        return {
          background: "#fee2e2",
          color: "#b91c1c",
          border: "1px solid #fca5a5",
        };
      case "recupero_bici":
        return {
          background: "#dcfce7",
          color: "#166534",
          border: "1px solid #86efac",
        };
      case "correzione":
        return {
          background: "#f3f4f6",
          color: "#4b5563",
          border: "1px solid #d1d5db",
        };
      default:
        return {
          background: "#f3f4f6",
          color: "#374151",
          border: "1px solid #d1d5db",
        };
    }
  }

  function movementLabel(type: string | null) {
    switch (type) {
      case "carico":
        return "Carico";
      case "officina":
        return "Officina";
      case "scarico":
        return "Scarico";
      case "recupero_bici":
        return "Recupero bici";
      case "correzione":
        return "Correzione";
      default:
        return type || "-";
    }
  }

  function movementDescription(m: Movement) {
    const wo = work(m.work_order_id);
    const b = bike(m.bike_id);

    if (m.type === "recupero_bici" && b) {
      return `Componente recuperato da ${b.brand || ""} ${b.model || ""}`.trim();
    }

    if (m.type === "officina" && wo) {
      return `Ricambio collegato alla scheda officina ${wo.id.slice(0, 6)}`;
    }

    if (m.type === "scarico" && b) {
      return `Componente montato su ${b.brand || ""} ${b.model || ""}`.trim();
    }

    if (m.type === "carico") {
      return "Ingresso prodotto a magazzino";
    }

    if (m.type === "correzione") {
      return "Correzione quantità o rettifica";
    }

    return "Movimento registrato";
  }

  const filtered = useMemo(() => {
    return movements.filter((m) => {
      const p = product(m.product_id);
      const b = bike(m.bike_id);
      const wo = work(m.work_order_id);
      const cust = customer(wo?.customer_id);

      const q = search.trim().toLowerCase();

      const text = [
        p?.title || "",
        p?.ean || "",
        b?.brand || "",
        b?.model || "",
        b?.frame_number || "",
        cust?.name || "",
        m.type || "",
        wo?.id || "",
      ]
        .join(" ")
        .toLowerCase();

      if (q && !text.includes(q)) return false;
      if (typeFilter && m.type !== typeFilter) return false;
      if (bikeFilter && m.bike_id !== bikeFilter) return false;

      if (dateFrom || dateTo) {
        if (!m.created_at) return false;

        const movementDate = new Date(m.created_at);

        if (dateFrom) {
          const fromDate = new Date(`${dateFrom}T00:00:00`);
          if (movementDate < fromDate) return false;
        }

        if (dateTo) {
          const toDate = new Date(`${dateTo}T23:59:59`);
          if (movementDate > toDate) return false;
        }
      }

      return true;
    });
  }, [
    movements,
    products,
    bikes,
    workOrders,
    customers,
    search,
    typeFilter,
    bikeFilter,
    dateFrom,
    dateTo,
  ]);

  const stats = useMemo(() => {
    return {
      total: filtered.length,
      carico: filtered.filter((m) => m.type === "carico").length,
      scarico: filtered.filter((m) => m.type === "scarico").length,
      officina: filtered.filter((m) => m.type === "officina").length,
      recupero: filtered.filter((m) => m.type === "recupero_bici").length,
    };
  }, [filtered]);

  return (
    <div style={page}>
      <div style={header}>
        <div>
          <h1 style={title}>Movimenti magazzino</h1>
          <p style={subtitle}>
            Interroga rapidamente i movimenti di prodotti, officina e bici
            aziendali.
          </p>
        </div>
      </div>

      <div style={filtersCard}>
        <div style={filtersGrid}>
          <input
            placeholder="Cerca prodotto, EAN, bici, telaio, cliente, scheda..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={searchInput}
          />

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={select}
          >
            <option value="">Tutti i movimenti</option>
            <option value="carico">Carico</option>
            <option value="officina">Officina</option>
            <option value="scarico">Scarico</option>
            <option value="recupero_bici">Recupero bici</option>
            <option value="correzione">Correzione</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={dateInput}
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={dateInput}
          />

          <button
            style={resetBtn}
            onClick={() => {
              setSearch("");
              setTypeFilter("");
              setBikeFilter("");
              setBikeSearch("");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Reset filtri
          </button>
        </div>

        <div style={bikeFilterSection}>
          <div style={bikeFilterHeader}>
            <div>
              <div style={bikeFilterTitle}>Filtro bici aziendale</div>
              <div style={bikeFilterSubtitle}>
                Scrivi per cercare una bici e selezionala dalle card.
              </div>
            </div>

            {selectedBike && (
              <div style={selectedBikeBadge}>
                <span>
                  🚲 {selectedBike.brand} {selectedBike.model}
                </span>
                <button
                  style={clearBikeBtn}
                  onClick={() => {
                    setBikeFilter("");
                    setBikeSearch("");
                  }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          <input
            placeholder="Cerca bici per brand, modello, telaio, colore o tipo..."
            value={bikeSearch}
            onChange={(e) => setBikeSearch(e.target.value)}
            style={bikeSearchInput}
          />

          {bikeSearch.trim() !== "" && (
            <div style={bikeSearchResultsWrap}>
              {filteredBikeOptions.length === 0 ? (
                <div style={bikeEmptyState}>
                  Nessuna bici trovata con questa ricerca.
                </div>
              ) : (
                <div style={bikeCardsGrid}>
                  {filteredBikeOptions.map((b) => {
                    const isSelected = bikeFilter === b.id;

                    return (
                      <button
                        key={b.id}
                        onClick={() => {
                          setBikeFilter(b.id);
                          setBikeSearch("");
                        }}
                        style={{
                          ...bikeOptionCard,
                          ...(isSelected ? bikeOptionCardSelected : {}),
                        }}
                      >
                        <div style={bikeOptionTop}>
                          <div style={bikeOptionTitle}>
                            🚲 {b.brand || "-"} {b.model || ""}
                          </div>
                          <div style={bikeOptionTypeBadge}>
                            {b.type || "Tipo n.d."}
                          </div>
                        </div>

                        <div style={bikeOptionMeta}>
                          <div>
                            <span style={bikeMetaLabel}>Telaio</span>
                            <span style={bikeMetaValue}>
                              {b.frame_number || "-"}
                            </span>
                          </div>
                          <div>
                            <span style={bikeMetaLabel}>Colore</span>
                            <span style={bikeMetaValue}>{b.color || "-"}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={statsGrid}>
        <StatCard label="Totali" value={stats.total} />
        <StatCard label="Carichi" value={stats.carico} />
        <StatCard label="Scarichi" value={stats.scarico} />
        <StatCard label="Officina" value={stats.officina} />
        <StatCard label="Recuperi bici" value={stats.recupero} />
      </div>

      {loading ? (
        <div style={emptyState}>Caricamento movimenti...</div>
      ) : filtered.length === 0 ? (
        <div style={emptyState}>
          Nessun movimento trovato con i filtri attuali.
        </div>
      ) : (
        <div style={list}>
          {filtered.map((m) => {
            const p = product(m.product_id);
            const b = bike(m.bike_id);
            const wo = work(m.work_order_id);
            const cust = customer(wo?.customer_id);

            return (
              <div key={m.id} style={card}>
                <div style={topRow}>
                  <div style={leftCol}>
                    <div style={productName}>
                      {p?.title || "Prodotto non trovato"}
                    </div>
                    <div style={subLine}>
                      EAN: {p?.ean || "-"} • Quantità:{" "}
                      <strong>{m.quantity || 0}</strong>
                    </div>
                    <div style={description}>{movementDescription(m)}</div>
                  </div>

                  <div style={rightCol}>
                    <span style={{ ...badge, ...badgeStyle(m.type) }}>
                      {movementLabel(m.type)}
                    </span>
                    <div style={date}>
                      {m.created_at
                        ? new Date(m.created_at).toLocaleString("it-IT")
                        : "-"}
                    </div>
                  </div>
                </div>

                <div style={bottomRow}>
                  <div style={linkGroup}>
                    {cust && (
                      <div style={metaCard}>
                        <div style={metaLabel}>Cliente</div>
                        <div style={metaValue}>{cust.name || "-"}</div>
                      </div>
                    )}

                    {wo && (
                      <button
                        style={actionBtn}
                        onClick={() => {
                          if (wo.status === "closed") {
                            router.push(`/workorders/${wo.id}/report`);
                          } else {
                            router.push(`/workorders/${wo.id}`);
                          }
                        }}
                      >
                        🔧 Scheda {wo.id.slice(0, 6)}
                      </button>
                    )}

                    {b && (
                      <button
                        style={bikeBtn}
                        onClick={() =>
                          router.push(`/inventory-bikes/${b.id}?view=true`)
                        }
                      >
                        🚲 {b.brand} {b.model}
                      </button>
                    )}
                  </div>

                  <div style={idBox}>ID movimento: {m.id.slice(0, 8)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MovementsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Caricamento...</div>}>
      <MovementsContent />
    </Suspense>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={statCard}>
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
    </div>
  );
}

const page: React.CSSProperties = {
  maxWidth: 1280,
  margin: "0 auto",
  padding: 24,
  background: "#f8fafc",
  minHeight: "100vh",
};

const header: React.CSSProperties = {
  marginBottom: 20,
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 32,
  fontWeight: 800,
  color: "#0f172a",
};

const subtitle: React.CSSProperties = {
  marginTop: 8,
  color: "#64748b",
  fontSize: 15,
};

const filtersCard: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 18,
  marginBottom: 18,
  boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
};

const filtersGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr 160px 160px auto",
  gap: 12,
};

const searchInput: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #dbe2ea",
  fontSize: 14,
  outline: "none",
};

const select: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #dbe2ea",
  fontSize: 14,
  background: "#fff",
  outline: "none",
};

const dateInput: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #dbe2ea",
  fontSize: 14,
  background: "#fff",
  outline: "none",
};

const resetBtn: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid #dbe2ea",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 700,
};

const bikeFilterSection: React.CSSProperties = {
  marginTop: 18,
  paddingTop: 18,
  borderTop: "1px solid #eef2f7",
};

const bikeFilterHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  flexWrap: "wrap",
  marginBottom: 12,
};

const bikeFilterTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: "#0f172a",
};

const bikeFilterSubtitle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: "#64748b",
};

const selectedBikeBadge: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  borderRadius: 999,
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 700,
};

const clearBikeBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#1d4ed8",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 14,
};

const bikeSearchInput: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #dbe2ea",
  fontSize: 14,
  outline: "none",
};

const bikeSearchResultsWrap: React.CSSProperties = {
  marginTop: 14,
};

const bikeEmptyState: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 18,
  color: "#64748b",
  textAlign: "center",
};

const bikeCardsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: 12,
};

const bikeOptionCard: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#fff",
  borderRadius: 16,
  padding: 14,
  cursor: "pointer",
  textAlign: "left",
  transition: "all 0.2s ease",
};

const bikeOptionCardSelected: React.CSSProperties = {
  border: "2px solid #2563eb",
  background: "#f8fbff",
  boxShadow: "0 10px 24px rgba(37,99,235,0.12)",
};

const bikeOptionTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
  marginBottom: 10,
};

const bikeOptionTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: "#0f172a",
};

const bikeOptionTypeBadge: React.CSSProperties = {
  background: "#ecfeff",
  color: "#0f766e",
  border: "1px solid #a5f3fc",
  borderRadius: 999,
  padding: "5px 8px",
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const bikeOptionMeta: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const bikeMetaLabel: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "#64748b",
  marginBottom: 4,
};

const bikeMetaValue: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "#0f172a",
  fontWeight: 700,
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 14,
  marginBottom: 22,
};

const statCard: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
};

const statLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  marginBottom: 8,
};

const statValue: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: "#0f172a",
};

const list: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  padding: 18,
  boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
};

const topRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 16,
};

const leftCol: React.CSSProperties = {
  flex: 1,
};

const rightCol: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 8,
};

const productName: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "#0f172a",
};

const subLine: React.CSSProperties = {
  marginTop: 6,
  color: "#64748b",
  fontSize: 13,
};

const description: React.CSSProperties = {
  marginTop: 10,
  fontSize: 14,
  color: "#334155",
};

const badge: React.CSSProperties = {
  padding: "7px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const date: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
};

const bottomRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const linkGroup: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const metaCard: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: "10px 12px",
};

const metaLabel: React.CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  marginBottom: 4,
};

const metaValue: React.CSSProperties = {
  fontSize: 13,
  color: "#0f172a",
  fontWeight: 700,
};

const actionBtn: React.CSSProperties = {
  background: "#e0e7ff",
  color: "#3730a3",
  border: "1px solid #c7d2fe",
  padding: "10px 12px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
};

const bikeBtn: React.CSSProperties = {
  background: "#e0f2fe",
  color: "#0c4a6e",
  border: "1px solid #bae6fd",
  padding: "10px 12px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
};

const idBox: React.CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
};

const emptyState: React.CSSProperties = {
  background: "#fff",
  border: "1px dashed #cbd5e1",
  borderRadius: 18,
  padding: 28,
  textAlign: "center",
  color: "#64748b",
};