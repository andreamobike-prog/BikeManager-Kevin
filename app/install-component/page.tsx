"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import ScanProductButton from "@/components/ScanProductButton";

type InventoryBike = {
  id: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  type: string | null;
  frame_number: string | null;
  purchase_price: number | null;
  current_value: number | null;
};

type Product = {
  id: string;
  title: string | null;
  ean: string | null;
  warehouse_qty: number | null;
  price_b2b: number | null;
};

type ToastType = "success" | "error" | "info";

export default function BikeAssembly() {
  const [bikes, setBikes] = useState<InventoryBike[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [bikeSearch, setBikeSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const [selectedBike, setSelectedBike] = useState<InventoryBike | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [quantity, setQuantity] = useState(1);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast(null);
    }, 3500);

    return () => clearTimeout(timer);
  }, [toast]);

  async function loadData() {
    setLoading(true);

    const [
      { data: bikesData, error: bikesError },
      { data: productsData, error: productsError },
    ] = await Promise.all([
      supabase.from("inventory_bikes").select("*").order("brand"),
      supabase.from("products").select("*").order("title"),
    ]);

    if (bikesError) {
      console.error("Errore caricamento bici:", bikesError);
      setToast({
        message: `Errore caricamento bici: ${bikesError.message}`,
        type: "error",
      });
    }

    if (productsError) {
      console.error("Errore caricamento prodotti:", productsError);
      setToast({
        message: `Errore caricamento prodotti: ${productsError.message}`,
        type: "error",
      });
    }

    setBikes((bikesData as InventoryBike[]) || []);
    setProducts((productsData as Product[]) || []);
    setLoading(false);
  }

  const filteredBikes = useMemo(() => {
    const q = bikeSearch.trim().toLowerCase();

    return bikes.filter((b) => {
      const text =
        `${b.brand || ""} ${b.model || ""} ${b.frame_number || ""} ${b.color || ""} ${b.type || ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [bikes, bikeSearch]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();

    return products.filter((p) => {
      const text = `${p.title || ""} ${p.ean || ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [products, productSearch]);

  function formatCurrency(value: number | null | undefined) {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(Number(value || 0));
  }

  const componentUnitValue = Number(selectedProduct?.price_b2b || 0);
  const totalComponentValue = componentUnitValue * Number(quantity || 0);

  const projectedBikeValue =
    Number(selectedBike?.current_value || 0) + totalComponentValue;

  const projectedWarehouseQty = selectedProduct
    ? Number(selectedProduct.warehouse_qty || 0) - Number(quantity || 0)
    : 0;

  function handleProductScan(value: string) {
    const code = value.trim();
    if (!code) return;

    setProductSearch(code);

    const normalized = code.toLowerCase();
    const exactMatches = products.filter((p) => {
      return (
        (p.ean || "").trim().toLowerCase() === normalized ||
        (p.title || "").trim().toLowerCase() === normalized
      );
    });

    if (exactMatches.length === 1) {
      const product = exactMatches[0];
      if (Number(product.warehouse_qty || 0) <= 0) {
        setSelectedProduct(null);
        setToast({
          message: "Prodotto trovato ma non disponibile a magazzino.",
          type: "error",
        });
        return;
      }

      setSelectedProduct(product);
      setToast({
        message: "Componente trovato e selezionato.",
        type: "success",
      });
      return;
    }

    if (exactMatches.length === 0) {
      setSelectedProduct(null);
      setToast({
        message: "Nessun prodotto trovato con il codice scansionato.",
        type: "error",
      });
      return;
    }

    setToast({
      message: "Piu' prodotti trovati: scegli il componente dalla lista filtrata.",
      type: "info",
    });
  }

  async function assemble() {
    setToast(null);

    if (!selectedBike || !selectedProduct) {
      setToast({
        message: "Seleziona una bici e un componente prima di continuare.",
        type: "error",
      });
      return;
    }

    if (!quantity || quantity < 1) {
      setToast({
        message: "Inserisci una quantità valida maggiore di zero.",
        type: "error",
      });
      return;
    }

    const currentWarehouseQty = Number(selectedProduct.warehouse_qty || 0);

    if (quantity > currentWarehouseQty) {
      setToast({
        message: `Quantità non disponibile. A magazzino ci sono solo ${currentWarehouseQty} pezzi.`,
        type: "error",
      });
      return;
    }

    setProcessing(true);

    const componentValue = Number(selectedProduct.price_b2b || 0) * quantity;
    const currentBikeValue = Number(selectedBike.current_value || 0);
    const newBikeValue = currentBikeValue + componentValue;
    const newWarehouseQty = currentWarehouseQty - quantity;

    try {
      const { error: productError } = await supabase
        .from("products")
        .update({
          warehouse_qty: newWarehouseQty,
        })
        .eq("id", selectedProduct.id);

      if (productError) {
        throw productError;
      }

      const { error: bikeError } = await supabase
        .from("inventory_bikes")
        .update({
          current_value: newBikeValue,
        })
        .eq("id", selectedBike.id);

      if (bikeError) {
        throw bikeError;
      }

      const { error: movementError } = await supabase
        .from("inventory_movements")
        .insert({
          product_id: selectedProduct.id,
          quantity,
          type: "scarico",
          bike_id: selectedBike.id,
        });

      if (movementError) {
        throw movementError;
      }

      setShowConfirm(false);

      setToast({
        message: `Componente montato correttamente. Magazzino aggiornato e valore bici aumentato di ${formatCurrency(
          componentValue
        )}.`,
        type: "success",
      });

      const bikeId = selectedBike.id;

      setSelectedProduct(null);
      setProductSearch("");
      setQuantity(1);

      await loadData();

      const refreshedBike = (
        await supabase.from("inventory_bikes").select("*").eq("id", bikeId).single()
      ).data as InventoryBike | null;

      if (refreshedBike) {
        setSelectedBike(refreshedBike);
      }
    } catch (err: any) {
      console.error("Errore durante registrazione montaggio:", err);
      setToast({
        message: `Errore durante la registrazione: ${err.message || "operazione non completata"}`,
        type: "error",
      });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div style={page}>
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

      {showConfirm && selectedBike && selectedProduct && (
        <div style={overlay}>
          <div style={confirmModal}>
            <div style={confirmIcon}>🛠️</div>
            <h2 style={confirmTitle}>Conferma montaggio componente</h2>
            <p style={confirmText}>
              Stai per montare <strong>{quantity}</strong> x{" "}
              <strong>{selectedProduct.title}</strong> sulla bici{" "}
              <strong>
                {selectedBike.brand} {selectedBike.model}
              </strong>
              .
            </p>

            <div style={confirmSummary}>
              <div style={confirmRow}>
                <span>Magazzino prodotto dopo operazione</span>
                <strong>{projectedWarehouseQty}</strong>
              </div>
              <div style={confirmRow}>
                <span>Aumento valore bici</span>
                <strong>{formatCurrency(totalComponentValue)}</strong>
              </div>
              <div style={confirmRow}>
                <span>Nuovo valore attuale bici</span>
                <strong>{formatCurrency(projectedBikeValue)}</strong>
              </div>
            </div>

            <div style={confirmButtons}>
              <button
                style={secondaryBtn}
                onClick={() => setShowConfirm(false)}
                disabled={processing}
              >
                Annulla
              </button>
              <button
                style={primaryBtn}
                onClick={assemble}
                disabled={processing}
              >
                {processing ? "Registrazione..." : "Conferma montaggio"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={header}>
        <div>
          <h1 style={mainTitle}>Montaggio componenti su bici aziendale</h1>
          <p style={subTitle}>
            Seleziona una bici, scegli il ricambio da montare e registra
            l’uscita dal magazzino con aggiornamento del valore della bici.
          </p>
        </div>
      </div>

      <div style={layout}>
        <div style={panel}>
          <div style={panelTop}>
            <h3 style={panelTitle}>🚲 Seleziona bici</h3>
            <span style={counterBadge}>{filteredBikes.length}</span>
          </div>

          <input
            placeholder="Cerca per marchio, modello, telaio, colore o tipo..."
            value={bikeSearch}
            onChange={(e) => setBikeSearch(e.target.value)}
            style={search}
          />

          <div style={list}>
            {filteredBikes.map((b) => (
              <div
                key={b.id}
                onClick={() => setSelectedBike(b)}
                style={{
                  ...bikeCard,
                  ...(selectedBike?.id === b.id ? selectedCard : {}),
                }}
              >
                <div style={cardTop}>
                  <div>
                    <div style={cardTitle}>
                      🚲 {b.brand} {b.model}
                    </div>
                    <div style={cardSub}>{b.type || "Tipo non definito"}</div>
                  </div>
                  <div style={greenBadge}>{formatCurrency(b.current_value)}</div>
                </div>

                <div style={detailsGrid}>
                  <div style={detailItem}>
                    <span style={detailLabel}>Telaio</span>
                    <span style={detailValue}>{b.frame_number || "-"}</span>
                  </div>
                  <div style={detailItem}>
                    <span style={detailLabel}>Colore</span>
                    <span style={detailValue}>{b.color || "-"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={panel}>
          <div style={panelTop}>
            <h3 style={panelTitle}>🔧 Seleziona componente</h3>
            <span style={counterBadge}>{filteredProducts.length}</span>
          </div>

          <div style={scanRow}>
            <input
              placeholder="Cerca per nome ricambio o EAN..."
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setSelectedProduct(null);
              }}
              style={{ ...search, marginBottom: 0, flex: 1, minWidth: 0 }}
            />
            <ScanProductButton onScan={handleProductScan} buttonStyle={scanButton} />
          </div>

          <div style={list}>
            {filteredProducts.map((p) => {
              const unavailable = Number(p.warehouse_qty || 0) <= 0;

              return (
                <div
                  key={p.id}
                  onClick={() => !unavailable && setSelectedProduct(p)}
                  style={{
                    ...productCard,
                    ...(selectedProduct?.id === p.id ? selectedCard : {}),
                    ...(unavailable ? disabledCard : {}),
                  }}
                >
                  <div style={cardTop}>
                    <div>
                      <div style={cardTitle}>🔩 {p.title}</div>
                      <div style={cardSub}>EAN: {p.ean || "-"}</div>
                    </div>
                    <div style={greenBadge}>{formatCurrency(p.price_b2b)}</div>
                  </div>

                  <div style={detailsGrid}>
                    <div style={detailItem}>
                      <span style={detailLabel}>Magazzino</span>
                      <span style={detailValue}>
                        {Number(p.warehouse_qty || 0)}
                      </span>
                    </div>
                    <div style={detailItem}>
                      <span style={detailLabel}>Stato</span>
                      <span
                        style={{
                          ...detailValue,
                          color: unavailable ? "#b91c1c" : "#047857",
                        }}
                      >
                        {unavailable ? "Esaurito" : "Disponibile"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={summaryBox}>
        <div style={summaryHeader}>
          <h3 style={summaryTitle}>Riepilogo operazione</h3>
        </div>

        <div style={summaryGrid}>
          <div style={summaryCard}>
            <div style={summaryLabel}>Bici selezionata</div>
            <div style={summaryValue}>
              {selectedBike
                ? `${selectedBike.brand || ""} ${selectedBike.model || ""}`
                : "Nessuna bici selezionata"}
            </div>
          </div>

          <div style={summaryCard}>
            <div style={summaryLabel}>Componente selezionato</div>
            <div style={summaryValue}>
              {selectedProduct?.title || "Nessun componente selezionato"}
            </div>
          </div>

          <div style={summaryCard}>
            <div style={summaryLabel}>Quantità</div>
            <input
              type="number"
              min={1}
              max={selectedProduct ? Number(selectedProduct.warehouse_qty || 0) : undefined}
              value={quantity}
              onChange={(e) =>
                setQuantity(Math.max(1, Number(e.target.value) || 1))
              }
              style={qty}
            />
          </div>

          <div style={summaryCard}>
            <div style={summaryLabel}>Valore totale componente</div>
            <div style={summaryBigValue}>
              {formatCurrency(totalComponentValue)}
            </div>
          </div>

          <div style={summaryCard}>
            <div style={summaryLabel}>Valore bici dopo montaggio</div>
            <div style={summaryBigValue}>
              {selectedBike ? formatCurrency(projectedBikeValue) : "-"}
            </div>
          </div>

          <div style={summaryCard}>
            <div style={summaryLabel}>Magazzino dopo montaggio</div>
            <div style={summaryBigValue}>
              {selectedProduct ? projectedWarehouseQty : "-"}
            </div>
          </div>
        </div>

        <button
          style={{
            ...actionButton,
            opacity:
              !selectedBike ||
              !selectedProduct ||
              processing ||
              (selectedProduct ? quantity > Number(selectedProduct.warehouse_qty || 0) : false)
                ? 0.7
                : 1,
            cursor:
              !selectedBike ||
              !selectedProduct ||
              processing ||
              (selectedProduct ? quantity > Number(selectedProduct.warehouse_qty || 0) : false)
                ? "not-allowed"
                : "pointer",
          }}
          onClick={() => setShowConfirm(true)}
          disabled={
            !selectedBike ||
            !selectedProduct ||
            processing ||
            (selectedProduct ? quantity > Number(selectedProduct.warehouse_qty || 0) : false)
          }
        >
          {processing ? "Operazione in corso..." : "Registra montaggio componente"}
        </button>
      </div>

      {loading && <div style={loadingBox}>Caricamento dati...</div>}
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
  marginBottom: 24,
};

const mainTitle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  color: "#0f172a",
  margin: 0,
};

const subTitle: React.CSSProperties = {
  marginTop: 8,
  color: "#64748b",
  fontSize: 15,
};

const layout: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 24,
};

const panel: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 20,
  boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
};

const panelTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 14,
};

const panelTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 800,
  color: "#0f172a",
};

const counterBadge: React.CSSProperties = {
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
};

const search: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  marginBottom: 16,
  border: "1px solid #dbe2ea",
  borderRadius: 12,
  fontSize: 14,
  outline: "none",
};

const scanRow: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "stretch",
  marginBottom: 16,
};

const scanButton: React.CSSProperties = {
  minHeight: 44,
  padding: "12px 14px",
};

const list: React.CSSProperties = {
  maxHeight: 450,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const bikeCard: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  cursor: "pointer",
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  transition: "all 0.2s ease",
};

const productCard: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  cursor: "pointer",
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  transition: "all 0.2s ease",
};

const disabledCard: React.CSSProperties = {
  opacity: 0.55,
  cursor: "not-allowed",
  background: "#f8fafc",
};

const selectedCard: React.CSSProperties = {
  border: "2px solid #2563eb",
  boxShadow: "0 10px 24px rgba(37,99,235,0.14)",
  background: "#f8fbff",
};

const cardTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  marginBottom: 12,
};

const cardTitle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 15,
  color: "#0f172a",
};

const cardSub: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: "#64748b",
};

const greenBadge: React.CSSProperties = {
  background: "#ecfdf5",
  border: "1px solid #a7f3d0",
  color: "#047857",
  borderRadius: 999,
  padding: "7px 10px",
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const detailsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const detailItem: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const detailLabel: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
};

const detailValue: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 600,
};

const summaryBox: React.CSSProperties = {
  marginTop: 24,
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 22,
  boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
};

const summaryHeader: React.CSSProperties = {
  marginBottom: 18,
};

const summaryTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 800,
  color: "#0f172a",
};

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  marginBottom: 20,
};

const summaryCard: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 16,
};

const summaryLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  marginBottom: 8,
};

const summaryValue: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "#0f172a",
};

const summaryBigValue: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: "#059669",
};

const qty: React.CSSProperties = {
  padding: 10,
  border: "1px solid #dbe2ea",
  borderRadius: 10,
  width: 110,
  fontSize: 15,
};

const actionButton: React.CSSProperties = {
  marginTop: 8,
  width: "100%",
  padding: 16,
  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontWeight: 800,
  fontSize: 16,
  boxShadow: "0 12px 28px rgba(37,99,235,0.22)",
};

const loadingBox: React.CSSProperties = {
  marginTop: 20,
  padding: 16,
  borderRadius: 14,
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
};

const toastStyle: React.CSSProperties = {
  position: "fixed",
  top: 24,
  right: 24,
  zIndex: 1000,
  padding: "16px 20px",
  borderRadius: 16,
  fontWeight: 800,
  fontSize: 15,
  boxShadow: "0 14px 32px rgba(15,23,42,0.16)",
  maxWidth: 460,
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

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1200,
  padding: 20,
};

const confirmModal: React.CSSProperties = {
  width: "100%",
  maxWidth: 620,
  background: "#fff",
  borderRadius: 24,
  padding: 28,
  boxShadow: "0 24px 60px rgba(15,23,42,0.25)",
};

const confirmIcon: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 18,
  background: "#dbeafe",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 30,
  marginBottom: 16,
};

const confirmTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  color: "#0f172a",
  fontWeight: 800,
};

const confirmText: React.CSSProperties = {
  marginTop: 12,
  color: "#475569",
  fontSize: 16,
  lineHeight: 1.5,
};

const confirmSummary: React.CSSProperties = {
  marginTop: 20,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const confirmRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  color: "#0f172a",
  fontSize: 15,
};

const confirmButtons: React.CSSProperties = {
  display: "flex",
  gap: 12,
  marginTop: 22,
};

const secondaryBtn: React.CSSProperties = {
  flex: 1,
  background: "#e2e8f0",
  color: "#0f172a",
  border: "none",
  borderRadius: 14,
  padding: "14px 18px",
  fontWeight: 700,
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  flex: 1,
  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
  color: "#fff",
  border: "none",
  borderRadius: 14,
  padding: "14px 18px",
  fontWeight: 800,
  cursor: "pointer",
};
