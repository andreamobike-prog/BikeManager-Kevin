"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Download, ArrowLeft } from "lucide-react";

type Product = {
  id: string;
  title: string;
  description: string | null;
  ean: string | null;
  supplier?: string | null;
  location: string | null;
  warehouse_qty: number;
  min_stock: number;
  reorder_qty: number;
  price_b2b: number | null;
  price_b2c: number | null;
};

type ToastType = "success" | "error" | "info";
type StatusFilter = "all" | "low" | "out";
type SortOption =
  | "urgency_desc"
  | "title_asc"
  | "title_desc"
  | "qty_asc"
  | "qty_desc"
  | "value_desc"
  | "reorder_desc";

export default function LowStockPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [locationFilter, setLocationFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("urgency_desc");

  const [toast, setToast] = useState<{
    type: ToastType;
    message: string;
  } | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase.from("products").select("*").order("title");

    if (error) {
      console.error("Errore caricamento prodotti sotto scorta:", error);
      setToast({
        type: "error",
        message: `Errore caricamento: ${error.message}`,
      });
      setLoading(false);
      return;
    }

    const normalized = ((data as Product[]) || []).map((p) => ({
      ...p,
      warehouse_qty: Number(p.warehouse_qty || 0),
      min_stock: Number((p as any).min_stock || 0),
      reorder_qty: Number((p as any).reorder_qty || 0),
      price_b2b:
        p.price_b2b === null || p.price_b2b === undefined ? null : Number(p.price_b2b),
      price_b2c:
        p.price_b2c === null || p.price_b2c === undefined ? null : Number(p.price_b2c),
    }));

    setProducts(normalized);
    setLoading(false);
  }

  function formatCurrency(value: number | null | undefined) {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(Number(value || 0));
  }

  function reorderEstimatedValue(product: Product) {
    return Number(product.price_b2b || 0) * Number(product.reorder_qty || 0);
  }

  function shortageAmount(product: Product) {
    const qty = Number(product.warehouse_qty || 0);
    const min = Number(product.min_stock || 0);
    return Math.max(0, min - qty);
  }

  function getStockStatus(product: Product) {
    const qty = Number(product.warehouse_qty || 0);
    const min = Number(product.min_stock || 0);

    if (qty <= 0) {
      return {
        label: "Esaurito",
        tone: "out" as const,
      };
    }

    if (qty <= min) {
      return {
        label: "Sotto scorta",
        tone: "low" as const,
      };
    }

    return {
      label: "OK",
      tone: "ok" as const,
    };
  }

  const lowStockBase = useMemo(() => {
    return products.filter((p) => {
      const qty = Number(p.warehouse_qty || 0);
      const min = Number(p.min_stock || 0);
      return qty <= min;
    });
  }, [products]);

  const uniqueLocations = useMemo(() => {
    return [...new Set(lowStockBase.map((p) => (p.location || "").trim()).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b)
    );
  }, [lowStockBase]);

  const uniqueSuppliers = useMemo(() => {
    return [...new Set(lowStockBase.map((p) => (p.supplier || "").trim()).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b)
    );
  }, [lowStockBase]);

  const filtered = useMemo(() => {
    let result = [...lowStockBase];

    const q = search.trim().toLowerCase();

    if (q) {
      result = result.filter((p) => {
        const text = [
          p.title || "",
          p.ean || "",
          p.description || "",
          p.location || "",
          p.supplier || "",
        ]
          .join(" ")
          .toLowerCase();

        return text.includes(q);
      });
    }

    if (statusFilter !== "all") {
      result = result.filter((p) => {
        const qty = Number(p.warehouse_qty || 0);
        const min = Number(p.min_stock || 0);

        if (statusFilter === "out") return qty <= 0;
        if (statusFilter === "low") return qty > 0 && qty <= min;
        return true;
      });
    }

    if (locationFilter) {
      result = result.filter((p) => (p.location || "") === locationFilter);
    }

    if (supplierFilter) {
      result = result.filter((p) => (p.supplier || "") === supplierFilter);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "title_asc":
          return (a.title || "").localeCompare(b.title || "");
        case "title_desc":
          return (b.title || "").localeCompare(a.title || "");
        case "qty_asc":
          return Number(a.warehouse_qty || 0) - Number(b.warehouse_qty || 0);
        case "qty_desc":
          return Number(b.warehouse_qty || 0) - Number(a.warehouse_qty || 0);
        case "value_desc":
          return reorderEstimatedValue(b) - reorderEstimatedValue(a);
        case "reorder_desc":
          return Number(b.reorder_qty || 0) - Number(a.reorder_qty || 0);
        case "urgency_desc":
        default:
          return shortageAmount(b) - shortageAmount(a);
      }
    });

    return result;
  }, [lowStockBase, search, statusFilter, locationFilter, supplierFilter, sortBy]);

  function exportCSV() {
    const rows = filtered.map((p) => ({
      nome: p.title || "",
      fornitore: p.supplier || "",
      descrizione: p.description || "",
      ean: p.ean || "",
      posizione: p.location || "",
      quantita_attuale: p.warehouse_qty || 0,
      scorta_minima: p.min_stock || 0,
      mancante: shortageAmount(p),
      riordino_consigliato: p.reorder_qty || 0,
      prezzo_b2b: p.price_b2b || 0,
      valore_riordino: reorderEstimatedValue(p).toFixed(2),
      stato: getStockStatus(p).label,
    }));

    const headers = Object.keys(rows[0] || { nome: "" });

    const csv = [
      headers.join(";"),
      ...rows.map((row) =>
        headers
          .map((h) => `"${String((row as any)[h] ?? "").replace(/"/g, '""')}"`)
          .join(";")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prodotti_sotto_scorta.csv";
    a.click();
    URL.revokeObjectURL(url);

    setToast({
      type: "success",
      message: "CSV prodotti sotto scorta esportato correttamente.",
    });
  }

  const totalLow = lowStockBase.filter((p) => {
    const qty = Number(p.warehouse_qty || 0);
    const min = Number(p.min_stock || 0);
    return qty > 0 && qty <= min;
  }).length;

  const totalOut = lowStockBase.filter((p) => Number(p.warehouse_qty || 0) <= 0).length;
  const totalMissing = filtered.reduce((acc, p) => acc + shortageAmount(p), 0);
  const totalReorderValue = filtered.reduce((acc, p) => acc + reorderEstimatedValue(p), 0);

  return (
    <div className="low-stock-page">
      {toast && (
        <div
          className={`low-stock-toast ${
            toast.type === "success"
              ? "low-stock-toast--success"
              : toast.type === "error"
                ? "low-stock-toast--error"
                : "low-stock-toast--info"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="low-stock-header">
        <div>
          <h1 className="low-stock-title">Prodotti sotto scorta</h1>
          <p className="low-stock-subtitle">
            Controlla rapidamente gli articoli esauriti o da riordinare.
          </p>
        </div>

        <div className="low-stock-header-actions">
          <button className="btn-secondary" onClick={exportCSV}>
            <Download size={17} strokeWidth={2} />
            <span>Esporta CSV</span>
          </button>

          <button className="btn-secondary" onClick={() => router.push("/print/low-stock")}>
            <span>Crea report</span>
          </button>

          <button className="btn-primary" onClick={() => router.push("/inventory")}>
            <ArrowLeft size={17} strokeWidth={2} />
            <span>Torna al magazzino</span>
          </button>
        </div>
      </div>

      <div className="low-stock-stats-grid">
        <div className="low-stock-stat-card">
          <div className="low-stock-stat-label">Articoli coinvolti</div>
          <div className="low-stock-stat-value">{filtered.length}</div>
        </div>
        <div className="low-stock-stat-card">
          <div className="low-stock-stat-label">Sotto scorta</div>
          <div className="low-stock-stat-value">{totalLow}</div>
        </div>
        <div className="low-stock-stat-card">
          <div className="low-stock-stat-label">Esauriti</div>
          <div className="low-stock-stat-value">{totalOut}</div>
        </div>
        <div className="low-stock-stat-card">
          <div className="low-stock-stat-label">Quantità mancanti</div>
          <div className="low-stock-stat-value">{totalMissing}</div>
        </div>
        <div className="low-stock-stat-card">
          <div className="low-stock-stat-label">Valore riordino stimato</div>
          <div className="low-stock-stat-value">{formatCurrency(totalReorderValue)}</div>
        </div>
      </div>

      <div className="low-stock-filters-card">
        <div className="low-stock-filters-grid">
          <input
            className="low-stock-search-input"
            placeholder="Ricerca: nome, EAN, descrizione, posizione, fornitore..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="low-stock-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">Tutti gli stati</option>
            <option value="low">Solo sotto scorta</option>
            <option value="out">Solo esauriti</option>
          </select>

          <select
            className="low-stock-select"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
          >
            <option value="">Tutti i fornitori</option>
            {uniqueSuppliers.map((supplier) => (
              <option key={supplier} value={supplier}>
                {supplier}
              </option>
            ))}
          </select>

          <select
            className="low-stock-select"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          >
            <option value="">Tutte le posizioni</option>
            {uniqueLocations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>

          <select
            className="low-stock-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          >
            <option value="urgency_desc">Urgenza maggiore</option>
            <option value="reorder_desc">Riordino maggiore</option>
            <option value="value_desc">Valore riordino maggiore</option>
            <option value="title_asc">Nome A-Z</option>
            <option value="title_desc">Nome Z-A</option>
            <option value="qty_asc">Quantità minore</option>
            <option value="qty_desc">Quantità maggiore</option>
          </select>

          <button
            className="low-stock-clear-btn"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setSupplierFilter("");
              setLocationFilter("");
              setSortBy("urgency_desc");
            }}
          >
            Reset
          </button>
        </div>

        <div className="low-stock-filter-summary">
          Risultati visualizzati: <strong>{filtered.length}</strong>
        </div>
      </div>

      {loading ? (
        <div className="low-stock-empty">Caricamento prodotti sotto scorta...</div>
      ) : filtered.length === 0 ? (
        <div className="low-stock-empty">Nessun prodotto trovato con i filtri attuali.</div>
      ) : (
        <div className="low-stock-table-wrap">
          <table className="low-stock-table">
            <thead>
              <tr className="low-stock-thead-row">
                <th className="low-stock-th">Nome</th>
                <th className="low-stock-th">Fornitore</th>
                <th className="low-stock-th">EAN</th>
                <th className="low-stock-th">Posizione</th>
                <th className="low-stock-th">Stato</th>
                <th className="low-stock-th low-stock-th--center">Q.tà</th>
                <th className="low-stock-th low-stock-th--center">Min</th>
                <th className="low-stock-th low-stock-th--center">Mancante</th>
                <th className="low-stock-th low-stock-th--center">Riordino</th>
                <th className="low-stock-th low-stock-th--right">B2B</th>
                <th className="low-stock-th low-stock-th--right">Valore riordino</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const status = getStockStatus(p);
                const isOut = Number(p.warehouse_qty || 0) <= 0;

                return (
                  <tr
                    key={p.id}
                    className={`low-stock-row ${
                      isOut ? "low-stock-row--out" : "low-stock-row--low"
                    }`}
                  >
                    <td className="low-stock-td">
                      <div className="low-stock-title-cell">{p.title}</div>
                      {p.description ? <div className="low-stock-sub-cell">{p.description}</div> : null}
                    </td>
                    <td className="low-stock-td">{p.supplier || "-"}</td>
                    <td className="low-stock-td">{p.ean || "-"}</td>
                    <td className="low-stock-td">{p.location || "-"}</td>
                    <td className="low-stock-td">
                      <span
                        className={`low-stock-badge ${
                          status.label === "Esaurito"
                            ? "low-stock-badge--out"
                            : status.label === "Sotto scorta"
                              ? "low-stock-badge--low"
                              : "low-stock-badge--ok"
                        }`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="low-stock-td low-stock-td--center">{p.warehouse_qty || 0}</td>
                    <td className="low-stock-td low-stock-td--center">{p.min_stock || 0}</td>
                    <td className="low-stock-td low-stock-td--center-strong">{shortageAmount(p)}</td>
                    <td className="low-stock-td low-stock-td--center">{p.reorder_qty || 0}</td>
                    <td className="low-stock-td low-stock-td--right">{formatCurrency(p.price_b2b)}</td>
                    <td className="low-stock-td low-stock-td--right-strong">
                      {formatCurrency(reorderEstimatedValue(p))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
