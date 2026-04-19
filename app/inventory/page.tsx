"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Modal from "@/components/Modal";
import ScanProductButton from "@/components/ScanProductButton";
import { AlertTriangle, Upload, Download, Plus, Package2 } from "lucide-react";

type Product = {
  id: string;
  title: string;
  description: string | null;
  ean: string | null;
  supplier: string | null;
  location: string | null;
  warehouse_qty: number;
  min_stock: number;
  reorder_qty: number;
  price_b2b: number | null;
  price_b2c: number | null;
};

type SupplierRow = {
  name: string | null;
};

type ToastType = "success" | "error" | "info";
type StockFilter = "all" | "available" | "low" | "out";
type SortOption =
  | "title_asc"
  | "title_desc"
  | "qty_desc"
  | "qty_asc"
  | "value_desc"
  | "value_asc";

export default function InventoryPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [locationFilter, setLocationFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("title_asc");

  const [toast, setToast] = useState<{
    type: ToastType;
    message: string;
  } | null>(null);

  useEffect(() => {
    loadProducts();
    loadSuppliers();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("title");

    if (error) {
      console.error("Errore caricamento prodotti:", error);
      setToast({
        type: "error",
        message: `Errore caricamento prodotti: ${error.message}`,
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
        p.price_b2b === null || p.price_b2b === undefined
          ? null
          : Number(p.price_b2b),
      price_b2c:
        p.price_b2c === null || p.price_b2c === undefined
          ? null
          : Number(p.price_b2c),
      supplier: p.supplier || null,
      location: p.location || null,
      description: p.description || null,
      ean: p.ean || null,
    }));

    setProducts(normalized);
    setLoading(false);
  }

  async function loadSuppliers() {
    const { data, error } = await supabase
      .from("suppliers")
      .select("name")
      .order("name");

    if (error) {
      console.error("Errore caricamento fornitori:", error);
      return;
    }

    const names = ((data as SupplierRow[]) || [])
      .map((s) => (s.name || "").trim())
      .filter(Boolean);

    setSuppliers([...new Set(names)].sort((a, b) => a.localeCompare(b)));
  }

  function formatCurrency(value: number | null | undefined) {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(Number(value || 0));
  }

  function stockValue(product: Product) {
    return Number(product.price_b2b || 0) * Number(product.warehouse_qty || 0);
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
        label: "Scorta bassa",
        tone: "low" as const,
      };
    }

    return {
      label: "Disponibile",
      tone: "ok" as const,
    };
  }

  const uniqueLocations = useMemo(() => {
    return [...new Set(products.map((p) => (p.location || "").trim()).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b)
    );
  }, [products]);

  const uniqueSuppliers = useMemo(() => {
    return [...new Set(products.map((p) => (p.supplier || "").trim()).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b)
    );
  }, [products]);

  const filtered = useMemo(() => {
    let result = [...products];

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

    if (stockFilter !== "all") {
      result = result.filter((p) => {
        const qty = Number(p.warehouse_qty || 0);
        const min = Number(p.min_stock || 0);

        if (stockFilter === "available") return qty > min;
        if (stockFilter === "low") return qty > 0 && qty <= min;
        if (stockFilter === "out") return qty <= 0;
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
        case "title_desc":
          return (b.title || "").localeCompare(a.title || "");
        case "qty_desc":
          return Number(b.warehouse_qty || 0) - Number(a.warehouse_qty || 0);
        case "qty_asc":
          return Number(a.warehouse_qty || 0) - Number(b.warehouse_qty || 0);
        case "value_desc":
          return stockValue(b) - stockValue(a);
        case "value_asc":
          return stockValue(a) - stockValue(b);
        case "title_asc":
        default:
          return (a.title || "").localeCompare(b.title || "");
      }
    });

    return result;
  }, [products, search, stockFilter, locationFilter, supplierFilter, sortBy]);

  async function updateProduct() {
    if (!editProduct) return;

    if (!editProduct.title?.trim()) {
      setToast({
        type: "error",
        message: "Il nome prodotto è obbligatorio.",
      });
      return;
    }

    setSaving(true);

    const payload = {
      title: editProduct.title.trim(),
      description: editProduct.description?.trim() || null,
      ean: editProduct.ean?.trim() || null,
      supplier: editProduct.supplier?.trim() || null,
      location: editProduct.location?.trim() || null,
      warehouse_qty: Number(editProduct.warehouse_qty || 0),
      min_stock: Number(editProduct.min_stock || 0),
      reorder_qty: Number(editProduct.reorder_qty || 0),
      price_b2b:
        editProduct.price_b2b === null || editProduct.price_b2b === undefined
          ? null
          : Number(editProduct.price_b2b),
      price_b2c:
        editProduct.price_b2c === null || editProduct.price_b2c === undefined
          ? null
          : Number(editProduct.price_b2c),
    };

    const { error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", editProduct.id);

    if (error) {
      console.error("Errore update prodotto:", error);
      setToast({
        type: "error",
        message: `Errore salvataggio: ${error.message}`,
      });
      setSaving(false);
      return;
    }

    setEditProduct(null);
    await loadProducts();
    setSaving(false);

    setToast({
      type: "success",
      message: "Articolo aggiornato correttamente.",
    });
  }

  async function deleteProduct() {
    if (!editProduct) return;

    const confirmDelete = window.confirm(
      `Eliminare definitivamente l'articolo "${editProduct.title}"?`
    );

    if (!confirmDelete) return;

    setDeleting(true);

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", editProduct.id);

    if (error) {
      console.error("Errore eliminazione prodotto:", error);
      setToast({
        type: "error",
        message: `Errore eliminazione: ${error.message}`,
      });
      setDeleting(false);
      return;
    }

    setEditProduct(null);
    await loadProducts();
    setDeleting(false);

    setToast({
      type: "success",
      message: "Articolo eliminato correttamente.",
    });
  }

  function exportCSV() {
    const rows = filtered.map((p) => ({
      nome: p.title || "",
      fornitore: p.supplier || "",
      descrizione: p.description || "",
      ean: p.ean || "",
      posizione: p.location || "",
      quantita: p.warehouse_qty || 0,
      scorta_minima: p.min_stock || 0,
      riordino_consigliato: p.reorder_qty || 0,
      prezzo_b2b: p.price_b2b || 0,
      prezzo_b2c: p.price_b2c || 0,
      valore: stockValue(p).toFixed(2),
      stato: getStockStatus(p).label,
    }));

    const headers = Object.keys(rows[0] || {
      nome: "",
      fornitore: "",
      descrizione: "",
      ean: "",
      posizione: "",
      quantita: "",
      scorta_minima: "",
      riordino_consigliato: "",
      prezzo_b2b: "",
      prezzo_b2c: "",
      valore: "",
      stato: "",
    });

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
    a.download = "magazzino.csv";
    a.click();
    URL.revokeObjectURL(url);

    setToast({
      type: "success",
      message: "CSV esportato correttamente.",
    });
  }

  const totalItems = products.length;
  const totalFiltered = filtered.length;

  const totalValue = products.reduce((acc, p) => acc + stockValue(p), 0);
  const totalQty = products.reduce((acc, p) => acc + Number(p.warehouse_qty || 0), 0);

  const outOfStockCount = products.filter((p) => Number(p.warehouse_qty || 0) <= 0).length;

  const lowStockCount = products.filter((p) => {
    const qty = Number(p.warehouse_qty || 0);
    const min = Number(p.min_stock || 0);
    return qty > 0 && qty <= min;
  }).length;

  function handleProductScan(value: string) {
    const code = value.trim();
    if (!code) return;

    setSearch(code);

    const normalized = code.toLowerCase();
    const exactMatches = products.filter((p) => {
      return (
        (p.ean || "").trim().toLowerCase() === normalized ||
        (p.title || "").trim().toLowerCase() === normalized
      );
    });

    if (exactMatches.length === 1) {
      setEditProduct(exactMatches[0]);
      setToast({
        type: "success",
        message: "Prodotto trovato e selezionato.",
      });
      return;
    }

    if (exactMatches.length === 0) {
      setToast({
        type: "error",
        message: "Nessun prodotto trovato con il codice scansionato.",
      });
      return;
    }

    setToast({
      type: "info",
      message: "Piu' prodotti trovati: filtra la lista con il codice scansionato.",
    });
  }

  return (
    <div style={container}>
      {toast && (
        <div
          style={{
            ...toastStyle,
            ...(toast.type === "success"
              ? toastSuccess
              : toast.type === "error"
                ? toastError
                : toastInfo),
          }}
        >
          {toast.message}
        </div>
      )}

      <div className="page-header page-header--inventory">
        <div className="page-header__left page-header__left--inventory">
          <h1 className="apple-page-title">Magazzino</h1>
          <p className="apple-page-subtitle">
            Gestisci prodotti, quantità e riordini del magazzino.
          </p>
        </div>

        <div className="page-header__right">

          <button
            onClick={() => router.push("/inventory/import")}
            className="btn-secondary"
          >
            <Upload size={17} strokeWidth={2} />
            <span>Importa prodotti</span>
          </button>

          <button onClick={exportCSV} className="btn-secondary">
            <Download size={17} strokeWidth={2} />
            <span>Esporta CSV</span>
          </button>

          <button
            onClick={() => router.push("/inventory/new")}
            className="btn-primary"
          >
            <Plus size={17} strokeWidth={2} />
            <span>Nuovo articolo</span>
          </button>
        </div>
      </div>

      <div className="section-grid-3 inventory-summary-grid">
        <div className="apple-panel inventory-summary-card">
          <div className="inventory-summary-value">
            {formatCurrency(totalValue)}
          </div>
          <div className="inventory-summary-label">Valore magazzino</div>
        </div>

        <div className="apple-panel inventory-summary-card">
          <div className="inventory-summary-value">{totalItems}</div>
          <div className="inventory-summary-label">Articoli totali</div>
        </div>

        <div className="apple-panel inventory-summary-card">
          <div className="inventory-summary-value">{totalQty}</div>
          <div className="inventory-summary-label">Quantità complessiva</div>
        </div>

        <div className="apple-panel inventory-summary-card">
          <div className="inventory-summary-value">{lowStockCount}</div>
          <div className="inventory-summary-label">Scorte basse</div>
        </div>

        <div className="apple-panel inventory-summary-card">
          <div className="inventory-summary-value">{outOfStockCount}</div>
          <div className="inventory-summary-label">Esauriti</div>
        </div>

        <button
          onClick={() => router.push("/inventory/low-stock")}
          className="apple-panel inventory-summary-card inventory-summary-action"
        >
          <div className="inventory-summary-icon">
            <AlertTriangle size={34} strokeWidth={2.2} />
          </div>

          <div className="inventory-summary-label inventory-summary-label--action">
            Sotto scorta
          </div>
        </button>
      </div>

      <div className="inventory-results-panel">
        <div className="inventory-filters-inner" style={filtersCard}>
          <div style={filtersGrid}>
            <div className="product-search-scan-row">
              <input
                className="inventory-filters-control"
                placeholder="Cerca nome, EAN, descrizione, posizione o fornitore..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={searchInput}
              />
              <ScanProductButton onScan={handleProductScan} />
            </div>

            <select
              className="inventory-filters-control"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as StockFilter)}
              style={select}
            >
              <option value="all">Tutti gli articoli</option>
              <option value="available">Disponibili</option>
              <option value="low">Scorta bassa</option>
              <option value="out">Esauriti</option>
            </select>

            <select
              className="inventory-filters-control"
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              style={select}
            >
              <option value="">Tutti i fornitori</option>
              {uniqueSuppliers.map((supplier) => (
                <option key={supplier} value={supplier}>
                  {supplier}
                </option>
              ))}
            </select>

            <select
              className="inventory-filters-control"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              style={select}
            >
              <option value="">Tutte le posizioni</option>
              {uniqueLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>

            <select
              className="inventory-filters-control"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              style={select}
            >
              <option value="title_asc">Nome A-Z</option>
              <option value="title_desc">Nome Z-A</option>
              <option value="qty_desc">Quantità maggiore</option>
              <option value="qty_asc">Quantità minore</option>
              <option value="value_desc">Valore maggiore</option>
              <option value="value_asc">Valore minore</option>
            </select>

            <button
              className="inventory-filters-control inventory-filters-reset"
              style={clearFiltersButton}
              onClick={() => {
                setSearch("");
                setStockFilter("all");
                setSupplierFilter("");
                setLocationFilter("");
                setSortBy("title_asc");
              }}
            >
              Reset
            </button>
          </div>

          <div style={filterSummary}>
            Risultati visualizzati: <strong>{totalFiltered}</strong>
          </div>
        </div>

        <div className="inventory-results-body">
          {loading ? (
            <div className="inventory-results-empty" style={emptyBox}>
              Caricamento prodotti...
            </div>
          ) : filtered.length === 0 ? (
            <div className="inventory-results-empty" style={emptyBox}>
              {search.trim() || stockFilter !== "all" || locationFilter || supplierFilter
                ? "Nessun articolo trovato con i filtri attuali."
                : "Nessun articolo presente in magazzino."}
            </div>
          ) : (
            <div className="apple-table-wrap inventory-results-table" style={tableWrap}>
              <table style={table}>
                <thead>
                  <tr style={theadRow}>
                    <th style={th}>Nome</th>
                    <th style={th}>Fornitore</th>
                    <th style={th}>Descrizione</th>
                    <th style={th}>EAN</th>
                    <th style={th}>Posizione</th>
                    <th style={th}>Stato</th>
                    <th style={thCenter}>Q.tà</th>
                    <th style={thCenter}>Min</th>
                    <th style={thCenter}>Riordino</th>
                    <th style={thRight}>B2B</th>
                    <th style={thRight}>B2C</th>
                    <th style={thRight}>Valore</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((p) => {
                    const status = getStockStatus(p);
                    const qty = Number(p.warehouse_qty || 0);
                    const min = Number(p.min_stock || 0);
                    const isLow = qty > 0 && qty <= min;

                    return (
                      <tr
                        key={p.id}
                        onClick={() => setEditProduct(p)}
                        style={{
                          ...tableRow,
                          ...(isLow ? lowStockRow : {}),
                        }}
                      >
                        <td style={td}>
                          <div style={titleCell}>{p.title}</div>
                        </td>
                        <td style={td}>{p.supplier || "-"}</td>
                        <td style={tdMuted}>{p.description || "-"}</td>
                        <td style={td}>{p.ean || "-"}</td>
                        <td style={td}>{p.location || "-"}</td>
                        <td style={td}>
                          <span
                            className={`inventory-stock-badge ${status.tone === "out"
                              ? "inventory-stock-badge--out"
                              : status.tone === "low"
                                ? "inventory-stock-badge--low"
                                : "inventory-stock-badge--ok"
                              }`}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td style={tdCenter}>{p.warehouse_qty || 0}</td>
                        <td style={tdCenter}>{p.min_stock || 0}</td>
                        <td style={tdCenter}>{p.reorder_qty || 0}</td>
                        <td style={tdRight}>{formatCurrency(p.price_b2b)}</td>
                        <td style={tdRight}>{formatCurrency(p.price_b2c)}</td>
                        <td style={tdRightStrong}>{formatCurrency(stockValue(p))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editProduct && (
        <Modal title="Modifica articolo" onClose={() => setEditProduct(null)}>
          <div className="inventory-modal-header-clean">
            <div className="inventory-modal-icon-clean">
              <Package2 size={24} strokeWidth={2} />
            </div>
            <div>
              <div className="inventory-modal-title-clean">Scheda articolo</div>
              <div className="inventory-modal-subtitle-clean">
                Aggiorna dati, quantità, scorta minima, riordino e prezzi del prodotto.
              </div>
            </div>
          </div>

          <div className="inventory-modal-grid-2-clean">
            <div className="inventory-modal-field-clean">
              <label className="inventory-modal-label-clean">Nome prodotto</label>
              <input
                className="apple-input inventory-modal-input-clean"
                value={editProduct.title || ""}
                onChange={(e) =>
                  setEditProduct({ ...editProduct, title: e.target.value })
                }
              />
            </div>

            <div className="inventory-modal-field-clean">
              <label className="inventory-modal-label-clean">EAN</label>
              <input
                className="apple-input inventory-modal-input-clean"
                value={editProduct.ean || ""}
                onChange={(e) =>
                  setEditProduct({ ...editProduct, ean: e.target.value })
                }
              />
            </div>
          </div>

          <div className="inventory-modal-grid-2-clean">
            <div className="inventory-modal-field-clean">
              <label className="inventory-modal-label-clean">Fornitore</label>
              <select
                className="apple-input inventory-modal-input-clean inventory-modal-select-clean"
                value={editProduct.supplier || ""}
                onChange={(e) =>
                  setEditProduct({ ...editProduct, supplier: e.target.value || null })
                }
              >
                <option value="">Nessun fornitore</option>
                {editProduct.supplier && !suppliers.includes(editProduct.supplier) && (
                  <option value={editProduct.supplier}>{editProduct.supplier}</option>
                )}
                {suppliers.map((supplier) => (
                  <option key={supplier} value={supplier}>
                    {supplier}
                  </option>
                ))}
              </select>
            </div>

            <div className="inventory-modal-field-clean">
              <label className="inventory-modal-label-clean">Posizione scaffale</label>
              <input
                className="apple-input inventory-modal-input-clean"
                value={editProduct.location || ""}
                onChange={(e) =>
                  setEditProduct({ ...editProduct, location: e.target.value })
                }
              />
            </div>
          </div>

          <div className="inventory-modal-grid-3-clean">
            <div className="inventory-modal-field-clean">
              <label className="inventory-modal-label-clean">Quantità magazzino</label>
              <input
                type="number"
                className="apple-input inventory-modal-input-clean"
                value={editProduct.warehouse_qty ?? 0}
                onChange={(e) =>
                  setEditProduct({
                    ...editProduct,
                    warehouse_qty: Number(e.target.value),
                  })
                }
              />
            </div>

            <div className="inventory-modal-field-clean">
              <label className="inventory-modal-label-clean">Scorta minima</label>
              <input
                type="number"
                className="apple-input inventory-modal-input-clean"
                value={editProduct.min_stock ?? 0}
                onChange={(e) =>
                  setEditProduct({
                    ...editProduct,
                    min_stock: Number(e.target.value),
                  })
                }
              />
            </div>

            <div className="inventory-modal-field-clean">
              <label className="inventory-modal-label-clean">Riordino consigliato</label>
              <input
                type="number"
                className="apple-input inventory-modal-input-clean"
                value={editProduct.reorder_qty ?? 0}
                onChange={(e) =>
                  setEditProduct({
                    ...editProduct,
                    reorder_qty: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>

          <div className="inventory-modal-field-clean inventory-modal-field-clean--full">
            <label className="inventory-modal-label-clean">Descrizione</label>
            <textarea
              className="apple-textarea inventory-modal-textarea-clean"
              value={editProduct.description || ""}
              onChange={(e) =>
                setEditProduct({
                  ...editProduct,
                  description: e.target.value,
                })
              }
            />
          </div>

          <div className="inventory-modal-grid-2-clean">
            <div className="inventory-modal-field-clean">
              <label className="inventory-modal-label-clean">Prezzo B2B</label>
              <input
                type="number"
                step="0.01"
                className="apple-input inventory-modal-input-clean"
                value={editProduct.price_b2b ?? 0}
                onChange={(e) =>
                  setEditProduct({
                    ...editProduct,
                    price_b2b: Number(e.target.value),
                  })
                }
              />
            </div>

            <div className="inventory-modal-field-clean">
              <label className="inventory-modal-label-clean">Prezzo B2C</label>
              <input
                type="number"
                step="0.01"
                className="apple-input inventory-modal-input-clean"
                value={editProduct.price_b2c ?? 0}
                onChange={(e) =>
                  setEditProduct({
                    ...editProduct,
                    price_b2c: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>

          <div className="inventory-modal-info-clean">
            <div className="inventory-modal-info-row-clean">
              <span>Stato scorte</span>
              <span
                className={`inventory-stock-badge ${getStockStatus(editProduct).tone === "out"
                    ? "inventory-stock-badge--out"
                    : getStockStatus(editProduct).tone === "low"
                      ? "inventory-stock-badge--low"
                      : "inventory-stock-badge--ok"
                  }`}
              >
                {getStockStatus(editProduct).label}
              </span>
            </div>

            <div className="inventory-modal-info-row-clean">
              <span>Scorta minima impostata</span>
              <strong>{editProduct.min_stock || 0}</strong>
            </div>

            <div className="inventory-modal-info-row-clean">
              <span>Riordino consigliato</span>
              <strong>{editProduct.reorder_qty || 0}</strong>
            </div>

            <div className="inventory-modal-info-row-clean">
              <span>Valore prodotto a magazzino</span>
              <strong>{formatCurrency(stockValue(editProduct))}</strong>
            </div>
          </div>

                    <div className="inventory-modal-footer-clean">
            <button
              onClick={deleteProduct}
              className="inventory-modal-btn-danger-clean"
              disabled={deleting || saving}
            >
              {deleting ? "Eliminazione..." : "Elimina"}
            </button>

            <div className="inventory-modal-footer-actions-clean">
              <button
                onClick={() => setEditProduct(null)}
                className="inventory-modal-btn-secondary-clean"
                disabled={deleting || saving}
              >
                Annulla
              </button>

              <button
                onClick={updateProduct}
                className="inventory-modal-btn-primary-clean"
                disabled={saving || deleting}
              >
                {saving ? "Salvataggio..." : "Salva"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

const container: React.CSSProperties = {
  maxWidth: 1280,
  margin: "32px auto",
  padding: "0 20px",
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 24,
  flexWrap: "wrap",
};

const headerActions: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const pageTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 34,
  fontWeight: 800,
  color: "#0f172a",
};

const pageSubtitle: React.CSSProperties = {
  marginTop: 8,
  color: "#64748b",
  fontSize: 15,
};

const counters: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 16,
  marginBottom: 24,
};

const counterCard: React.CSSProperties = {
  background: "#fff",
  padding: 20,
  borderRadius: 18,
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
};

const counterLabel: React.CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  marginBottom: 8,
};

const counterValue: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: "#0f172a",
};

const filtersCard: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 0,
  padding: 16,
  marginBottom: 20,
  boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
};

const filtersGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto",
  gap: 12,
  alignItems: "stretch",
};

const filterSummary: React.CSSProperties = {
  marginTop: 12,
  fontSize: 13,
  color: "#64748b",
};

const searchInput: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid #dbe2ea",
  borderRadius: 0,
  fontSize: 14,
  outline: "none",
  background: "#fff",
};

const select: React.CSSProperties = {
  width: "100%",
  height: 44,
  padding: "0 14px",
  border: "1px solid #dbe2ea",
  borderRadius: 6,
  fontSize: 14,
  outline: "none",
  background: "#fff",
  color: "#0f172a",
};

const clearFiltersButton: React.CSSProperties = {
  height: 44,
  padding: "0 16px",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  background: "#f8fafc",
  cursor: "pointer",
  fontWeight: 700,
  color: "#0f172a",
  whiteSpace: "nowrap",
};

const importButton: React.CSSProperties = {
  background: "#eef6ff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
  padding: "11px 16px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const warningButton: React.CSSProperties = {
  background: "#fff7ed",
  color: "#c2410c",
  border: "1px solid #fdba74",
  padding: "11px 16px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 1420,
};

const theadRow: React.CSSProperties = {
  background: "#f8fafc",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 14,
  borderBottom: "1px solid #e5e7eb",
  fontSize: 12,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const thCenter: React.CSSProperties = {
  ...th,
  textAlign: "center",
};

const thRight: React.CSSProperties = {
  ...th,
  textAlign: "right",
};

const tableRow: React.CSSProperties = {
  cursor: "pointer",
  borderBottom: "1px solid #f1f5f9",
};

const lowStockRow: React.CSSProperties = {
  background: "#fffdf7",
};

const td: React.CSSProperties = {
  padding: 14,
  color: "#0f172a",
  fontSize: 14,
  verticalAlign: "top",
};

const tdMuted: React.CSSProperties = {
  ...td,
  color: "#64748b",
};

const tdCenter: React.CSSProperties = {
  ...td,
  textAlign: "center",
  fontWeight: 700,
};

const tdRight: React.CSSProperties = {
  ...td,
  textAlign: "right",
};

const tdRightStrong: React.CSSProperties = {
  ...tdRight,
  fontWeight: 800,
};

const titleCell: React.CSSProperties = {
  fontWeight: 700,
  color: "#0f172a",
};

const subCell: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#64748b",
};

const stockBadgeBase: React.CSSProperties = {
  display: "inline-block",
  padding: "5px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
};

const stockBadgeOk: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
};

const stockBadgeLow: React.CSSProperties = {
  background: "#fef3c7",
  color: "#b45309",
};

const stockBadgeOut: React.CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
};

const modalHeaderBox: React.CSSProperties = {
  display: "flex",
  gap: 14,
  alignItems: "flex-start",
  marginBottom: 20,
};

const modalIcon: React.CSSProperties = {
  width: 50,
  height: 50,
  borderRadius: 14,
  background: "#dbeafe",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
  flexShrink: 0,
};

const modalTitle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  color: "#0f172a",
};

const modalSubtitle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 14,
  color: "#64748b",
};

const formGrid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 18,
  marginBottom: 18,
};

const formGrid3: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 18,
  marginBottom: 18,
};

const field: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const label: React.CSSProperties = {
  fontSize: 13,
  color: "#475569",
  marginBottom: 8,
  fontWeight: 700,
};

const input: React.CSSProperties = {
  padding: 12,
  border: "1px solid #dbe2ea",
  borderRadius: 10,
  fontSize: 14,
  outline: "none",
};

const textarea: React.CSSProperties = {
  padding: 12,
  border: "1px solid #dbe2ea",
  borderRadius: 10,
  height: 120,
  width: "100%",
  marginBottom: 18,
  fontSize: 14,
  resize: "vertical",
  outline: "none",
};

const infoBox: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 16,
  marginBottom: 18,
};

const infoRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  color: "#0f172a",
  marginBottom: 10,
};

const footer: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  marginTop: 20,
  flexWrap: "wrap",
};

const primaryButton: React.CSSProperties = {
  background: "linear-gradient(135deg,#4f7cff,#3b82f6)",
  color: "#fff",
  border: "none",
  padding: "11px 16px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  boxShadow: "0 12px 24px rgba(59,130,246,0.18)",
};

const secondaryButton: React.CSSProperties = {
  padding: "11px 16px",
  border: "1px solid #d1d5db",
  background: "#f8fafc",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
  color: "#0f172a",
};

const dangerButton: React.CSSProperties = {
  background: "#ef4444",
  color: "#fff",
  border: "none",
  padding: "11px 16px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const emptyBox: React.CSSProperties = {
  background: "#fff",
  border: "1px dashed #cbd5e1",
  borderRadius: 18,
  padding: 28,
  textAlign: "center",
  color: "#64748b",
};

const toastStyle: React.CSSProperties = {
  position: "fixed",
  top: 24,
  right: 24,
  zIndex: 1100,
  padding: "14px 18px",
  borderRadius: 14,
  fontWeight: 700,
  boxShadow: "0 12px 30px rgba(15,23,42,0.16)",
  maxWidth: 420,
};

const toastSuccess: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  border: "1px solid #86efac",
};

const toastError: React.CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "1px solid #fca5a5",
};

const toastInfo: React.CSSProperties = {
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid #93c5fd",
};
