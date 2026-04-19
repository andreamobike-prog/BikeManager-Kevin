"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";

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
  customer_id?: string | null;
  brand: string | null;
  model: string | null;
  serial_number?: string | null;
  color?: string | null;
  bike_type?: string | null;
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
        .from("bikes")
        .select("id, customer_id, brand, model, color, bike_type, serial_number"),
      supabase.from("work_orders").select("id,customer_id,status"),
      supabase.from("customers").select("id,name"),
    ]);

    if (movError) console.error("Errore movimenti:", movError);
    if (prodError) console.error("Errore prodotti:", prodError);
    if (bikError) console.error("Errore bici:", bikError);
    if (woError) console.error("Errore work orders:", woError);
    if (custError) console.error("Errore clienti:", custError);

    setMovements((mov as any) || []);
    setProducts((prod as any) || []);
    setBikes((bik as any) || []);
    setWorkOrders((wo as any) || []);
    setCustomers((cust as any) || []);
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

    if (q.length < 2) return [];

    return bikes
      .filter((b) => {
        const brand = (b.brand || "").toLowerCase();
        const model = (b.model || "").toLowerCase();
        const serial = (b.serial_number || "").toLowerCase();

        return (
          brand.startsWith(q) ||
          model.startsWith(q) ||
          serial.includes(q)
        );
      })
      .slice(0, 12);
  }, [bikes, bikeSearch]);

  function badgeClass(type: string | null) {
    switch (type) {
      case "carico":
        return "movements-type-badge movements-type-badge--carico";
      case "officina":
        return "movements-type-badge movements-type-badge--officina";
      case "scarico":
        return "movements-type-badge movements-type-badge--scarico";
      case "recupero_bici":
        return "movements-type-badge movements-type-badge--recupero-bici";
      case "correzione":
        return "movements-type-badge movements-type-badge--correzione";
      default:
        return "movements-type-badge movements-type-badge--default";
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
        b?.serial_number || "",
        b?.color || "",
        b?.bike_type || "",
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
    <div className="app-page-shell movements-page-shell">
      <div className="page-stack">
        <div className="page-header movements-header">
          <div className="page-header__left">
            <div className="apple-kicker">Magazzino</div>
            <h1 className="apple-page-title">Movimenti magazzino</h1>
            <p className="apple-page-subtitle">
              Interroga rapidamente i movimenti di prodotti, officina e bici aziendali.
            </p>
          </div>
        </div>

        <div className="apple-panel movements-filters-panel">
          <div className="movements-filters-grid">
            <input
              className="apple-input"
              placeholder="Cerca prodotto, EAN, bici, telaio, cliente, scheda..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="apple-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Tutti i movimenti</option>
              <option value="carico">Carico</option>
              <option value="officina">Officina</option>
              <option value="scarico">Scarico</option>
              <option value="recupero_bici">Recupero bici</option>
              <option value="correzione">Correzione</option>
            </select>

            <input
              className="apple-input"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />

            <input
              className="apple-input"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />

            <button
              className="btn-secondary movements-reset-btn"
              onClick={() => {
                setSearch("");
                setTypeFilter("");
                setBikeFilter("");
                setBikeSearch("");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Reset
            </button>
          </div>

          <div className="movements-bike-filter-section">
            <div className="movements-bike-filter-header">
              <div>
                <div className="movements-bike-filter-title">Filtro bici cliente</div>
                <div className="movements-bike-filter-subtitle">
                  Scrivi per cercare una bici registrata e selezionala dalle card.
                </div>
              </div>

              {selectedBike && (
                <div className="movements-selected-bike-badge">
                  <span>
                    🚲 {selectedBike.brand} {selectedBike.model}
                  </span>
                  <button
                    type="button"
                    className="movements-clear-bike-btn"
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
              className="apple-input"
              placeholder="Cerca bici cliente per brand, modello, telaio, colore o tipo..."
              value={bikeSearch}
              onChange={(e) => setBikeSearch(e.target.value)}
            />

            {bikeSearch.trim() !== "" && (
              <div className="movements-bike-search-results-wrap">
                {filteredBikeOptions.length === 0 ? (
                  <div className="apple-empty movements-bike-empty-state">
                    Nessuna bici trovata con questa ricerca.
                  </div>
                ) : (
                  <div className="movements-bike-cards-grid">
                    {filteredBikeOptions.map((b) => {
                      const isSelected = bikeFilter === b.id;

                      return (
                        <button
                          key={b.id}
                          onClick={() => {
                            setBikeFilter(b.id);
                            setBikeSearch("");
                          }}
                          className={`movements-bike-option-card${isSelected ? " is-selected" : ""}`}
                        >
                          <div className="movements-bike-option-top">
                            <div className="movements-bike-option-title">
                              🚲 {b.brand || "-"} {b.model || ""}
                            </div>
                            <div className="movements-bike-option-type-badge">
                              {b.bike_type || "Tipo n.d."}
                            </div>
                          </div>

                          <div className="movements-bike-option-meta">
                            <div>
                              <span className="movements-bike-meta-label">Telaio</span>
                              <span className="movements-bike-meta-value">
                                {b.serial_number || "-"}
                              </span>
                            </div>
                            <div>
                              <span className="movements-bike-meta-label">Colore</span>
                              <span className="movements-bike-meta-value">{b.color || "-"}</span>
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

        <div className="movements-stats-grid">
          <StatCard label="Totali" value={stats.total} />
          <StatCard label="Carichi" value={stats.carico} />
          <StatCard label="Scarichi" value={stats.scarico} />
          <StatCard label="Officina" value={stats.officina} />
        </div>

        {loading ? (
          <div className="apple-empty movements-empty-state">Caricamento movimenti...</div>
        ) : filtered.length === 0 ? (
          <div className="apple-empty movements-empty-state">
            Nessun movimento trovato con i filtri attuali.
          </div>
        ) : (
          <div className="movements-list">
            {filtered.map((m) => {
              const p = product(m.product_id);
              const b = bike(m.bike_id);
              const wo = work(m.work_order_id);
              const cust = customer(wo?.customer_id);

              return (
                <div key={m.id} className="apple-panel movements-card">
                  <div className="movements-card__top">
                    <div className="movements-card__left">
                      <div className="movements-card__product-name">
                        {p?.title || "Prodotto non trovato"}
                      </div>
                      <div className="movements-card__subline">
                        EAN: {p?.ean || "-"} • Quantità: <strong>{m.quantity || 0}</strong>
                      </div>
                      <div className="movements-card__description">{movementDescription(m)}</div>
                    </div>

                    <div className="movements-card__right">
                      <span className={badgeClass(m.type)}>
                        {movementLabel(m.type)}
                      </span>
                      <div className="movements-card__date">
                        {m.created_at
                          ? new Date(m.created_at).toLocaleString("it-IT")
                          : "-"}
                      </div>
                    </div>
                  </div>

                  <div className="movements-card__bottom">
                    <div className="movements-card__links">
                      {cust && (
                        <div className="movements-meta-card movements-meta-card--client">
                          <div className="movements-meta-card__value">
                            Cliente: {cust.name || "-"}
                          </div>
                        </div>
                      )}

                      {wo && (
                        <button
                          className="movements-action-btn movements-action-btn--workorder"
                          onClick={() => {
                            if (wo.status === "closed") {
                              router.push(`/workorders/${wo.id}/report`);
                            } else {
                              router.push(`/workorders/${wo.id}`);
                            }
                          }}
                        >
                          <FileText size={16} strokeWidth={2} />
                          <span>Scheda cliente</span>
                        </button>
                      )}

                    </div>

                    <div className="movements-card__id-box">ID movimento: {m.id.slice(0, 8)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MovementsPage() {
  return (
    <Suspense fallback={<div className="movements-loading-fallback">Caricamento...</div>}>
      <MovementsContent />
    </Suspense>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="dashboard-metric-card movements-metric-card">
      <div className="dashboard-metric-label">{label}</div>
      <div className="dashboard-metric-value movements-metric-value">{value}</div>
    </div>
  );
}

