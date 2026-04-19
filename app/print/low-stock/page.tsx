"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Printer } from "lucide-react";

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
};

type GroupedProducts = {
  supplier: string;
  items: Product[];
};

export default function LowStockPrintPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("supplier", { ascending: true })
      .order("title", { ascending: true });

    if (error) {
      console.error("Errore caricamento prodotti:", error);
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
    }));

    const lowStockOnly = normalized.filter((p) => {
      const qty = Number(p.warehouse_qty || 0);
      const min = Number(p.min_stock || 0);
      return qty <= min;
    });

    setProducts(lowStockOnly);
    setLoading(false);
  }

  function formatCurrency(value: number | null | undefined) {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(Number(value || 0));
  }

  function shortageAmount(product: Product) {
    return Math.max(0, Number(product.min_stock || 0) - Number(product.warehouse_qty || 0));
  }

  function reorderEstimatedValue(product: Product) {
    return Number(product.price_b2b || 0) * Number(product.reorder_qty || 0);
  }

  function getStatus(product: Product) {
    if (Number(product.warehouse_qty || 0) <= 0) return "Esaurito";
    return "Sotto scorta";
  }

  const grouped = useMemo<GroupedProducts[]>(() => {
    const map = new Map<string, Product[]>();

    for (const product of products) {
      const supplier = (product.supplier || "Senza fornitore").trim();

      if (!map.has(supplier)) {
        map.set(supplier, []);
      }

      map.get(supplier)!.push(product);
    }

    return Array.from(map.entries())
      .map(([supplier, items]) => ({
        supplier,
        items,
      }))
      .sort((a, b) => a.supplier.localeCompare(b.supplier));
  }, [products]);

  const totals = useMemo(() => {
    return {
      totalProducts: products.length,
      totalOut: products.filter((p) => Number(p.warehouse_qty || 0) <= 0).length,
      totalLow: products.filter((p) => Number(p.warehouse_qty || 0) > 0).length,
      totalMissing: products.reduce((acc, p) => acc + shortageAmount(p), 0),
      totalValue: products.reduce((acc, p) => acc + reorderEstimatedValue(p), 0),
    };
  }, [products]);

  const printedAt = useMemo(() => new Date(), []);

  if (loading) {
    return <div className="low-stock-print-loading">Preparazione stampa...</div>;
  }

  return (
    <div className="low-stock-print-page">
      <div className="low-stock-print-toolbar">
        <button
          type="button"
          className="low-stock-print-toolbar__button low-stock-print-toolbar__button--ghost"
          onClick={() => {
            window.location.href = "/inventory/low-stock";
          }}
        >
          Chiudi
        </button>
        <button
          type="button"
          className="low-stock-print-toolbar__button low-stock-print-toolbar__button--primary"
          onClick={() => window.print()}
        >
          <Printer size={18} strokeWidth={2.2} />
          <span>Stampa report</span>
        </button>
      </div>

      <div className="low-stock-print-sheet">
        <div className="low-stock-print-header">
          <div>
            <h1 className="low-stock-print-title">Report prodotti sotto scorta</h1>
            <div className="low-stock-print-subtitle">
              Elenco articoli da riordinare divisi per fornitore.
            </div>
          </div>

          <div className="low-stock-print-meta">
            <div>Data: {printedAt.toLocaleDateString("it-IT")}</div>
            <div>Ora: {printedAt.toLocaleTimeString("it-IT")}</div>
          </div>
        </div>

        <div className="low-stock-print-summary-grid">
          <div className="low-stock-print-summary-card">
            <div className="low-stock-print-summary-label">Articoli coinvolti</div>
            <div className="low-stock-print-summary-value">{totals.totalProducts}</div>
          </div>
          <div className="low-stock-print-summary-card">
            <div className="low-stock-print-summary-label">Sotto scorta</div>
            <div className="low-stock-print-summary-value">{totals.totalLow}</div>
          </div>
          <div className="low-stock-print-summary-card">
            <div className="low-stock-print-summary-label">Esauriti</div>
            <div className="low-stock-print-summary-value">{totals.totalOut}</div>
          </div>
          <div className="low-stock-print-summary-card">
            <div className="low-stock-print-summary-label">Quantità mancanti</div>
            <div className="low-stock-print-summary-value">{totals.totalMissing}</div>
          </div>
          <div className="low-stock-print-summary-card">
            <div className="low-stock-print-summary-label">Valore riordino stimato</div>
            <div className="low-stock-print-summary-value low-stock-print-summary-value--currency">
              {formatCurrency(totals.totalValue)}
            </div>
          </div>
        </div>

        {grouped.length === 0 ? (
          <div className="low-stock-print-empty">
            <h2 className="low-stock-print-empty__title">Nessun articolo sotto scorta</h2>
            <p className="low-stock-print-empty__text">
              Al momento non risultano prodotti da riordinare.
            </p>
          </div>
        ) : (
          grouped.map((group) => {
            const supplierMissing = group.items.reduce(
              (acc, item) => acc + shortageAmount(item),
              0
            );

            const supplierValue = group.items.reduce(
              (acc, item) => acc + reorderEstimatedValue(item),
              0
            );

            return (
              <section key={group.supplier} className="low-stock-print-supplier-block">
                <h2 className="low-stock-print-supplier-title">{group.supplier}</h2>

                <div className="low-stock-print-supplier-summary">
                  <div>
                    <strong>Articoli:</strong> {group.items.length}
                  </div>
                  <div>
                    <strong>Quantità mancanti:</strong> {supplierMissing}
                  </div>
                  <div>
                    <strong>Valore riordino:</strong> {formatCurrency(supplierValue)}
                  </div>
                </div>

                <div className="low-stock-print-table-wrap">
                  <table className="low-stock-print-table">
                    <thead>
                      <tr>
                        <th className="low-stock-print-col low-stock-print-col--article">Articolo</th>
                        <th className="low-stock-print-col low-stock-print-col--ean">EAN</th>
                        <th className="low-stock-print-col low-stock-print-col--location">Posizione</th>
                        <th className="low-stock-print-col low-stock-print-col--status low-stock-print-text-center">
                          Stato
                        </th>
                        <th className="low-stock-print-col low-stock-print-col--qty low-stock-print-text-center">
                          Q.tà
                        </th>
                        <th className="low-stock-print-col low-stock-print-col--qty low-stock-print-text-center">
                          Min
                        </th>
                        <th className="low-stock-print-col low-stock-print-col--missing low-stock-print-text-center">
                          Manc.
                        </th>
                        <th className="low-stock-print-col low-stock-print-col--reorder low-stock-print-text-center">
                          Riord.
                        </th>
                        <th className="low-stock-print-col low-stock-print-col--price low-stock-print-text-right">
                          B2B
                        </th>
                        <th className="low-stock-print-col low-stock-print-col--value low-stock-print-text-right">
                          Valore
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => {
                        const status = getStatus(item);

                        return (
                          <tr key={item.id}>
                            <td>
                              <strong>{item.title}</strong>
                              {item.description ? (
                                <div className="low-stock-print-muted">{item.description}</div>
                              ) : null}
                            </td>
                            <td>{item.ean || "-"}</td>
                            <td>{item.location || "-"}</td>
                            <td className="low-stock-print-text-center">
                              <span
                                className={
                                  status === "Esaurito"
                                    ? "low-stock-print-status low-stock-print-status--out"
                                    : "low-stock-print-status low-stock-print-status--low"
                                }
                              >
                                {status}
                              </span>
                            </td>
                            <td className="low-stock-print-text-center">{item.warehouse_qty || 0}</td>
                            <td className="low-stock-print-text-center">{item.min_stock || 0}</td>
                            <td className="low-stock-print-text-center">{shortageAmount(item)}</td>
                            <td className="low-stock-print-text-center">{item.reorder_qty || 0}</td>
                            <td className="low-stock-print-text-right">{formatCurrency(item.price_b2b)}</td>
                            <td className="low-stock-print-text-right">
                              {formatCurrency(reorderEstimatedValue(item))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}