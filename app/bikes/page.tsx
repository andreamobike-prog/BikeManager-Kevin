"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Customer = {
  id: string;
  name: string | null;
};

const BIKE_TYPE_OPTIONS = [
  "Cargo",
  "E-Cargo",
  "City / Urban",
  "E-City / Urban",
];

type BikeRow = {
  id: string;
  customer_id: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  bike_type: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  invoice_number: string | null;
  purchase_price: number | null;
  sale_price: number | null;
  notes: string | null;
  created_at: string | null;
  customers?: {
    name?: string | null;
  } | null;
};

type BikeForm = {
  customer_id: string;
  brand: string;
  model: string;
  color: string;
  bike_type: string;
  serial_number: string;
  purchase_date: string;
  invoice_number: string;
  purchase_price: string;
  sale_price: string;
  notes: string;
};

type Toast =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | { type: "info"; message: string }
  | null;

const initialForm: BikeForm = {
  customer_id: "",
  brand: "",
  model: "",
  color: "",
  bike_type: "",
  serial_number: "",
  purchase_date: "",
  invoice_number: "",
  purchase_price: "",
  sale_price: "",
  notes: "",
};

export default function BikesPage() {
  return (
    <Suspense fallback={<div style={loadingWrap}>Caricamento pagina bici...</div>}>
      <BikesPageContent />
    </Suspense>
  );
}

function BikesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const customerIdFromQuery =
  searchParams.get("customer_id") ||
  searchParams.get("customerId") ||
  "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [bikes, setBikes] = useState<BikeRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [toast, setToast] = useState<Toast>(null);

  const [form, setForm] = useState<BikeForm>(initialForm);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!customerIdFromQuery) return;

    setForm((prev) => ({
      ...prev,
      customer_id: customerIdFromQuery,
    }));
  }, [customerIdFromQuery]);

  useEffect(() => {
    if (customerIdFromQuery) {
      setShowModal(true);
    }
  }, [customerIdFromQuery]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadData() {
    setLoading(true);

    const [
      { data: bikeData, error: bikeError },
      { data: customerData, error: customerError },
    ] = await Promise.all([
      supabase
        .from("bikes")
        .select(
          `
          id,
          customer_id,
          brand,
          model,
          color,
          bike_type,
          serial_number,
          purchase_date,
          invoice_number,
          purchase_price,
          sale_price,
          notes,
          created_at,
          customers(name)
        `
        )
        .order("created_at", { ascending: false }),
      supabase.from("customers").select("id,name").order("name", { ascending: true }),
    ]);

    if (bikeError) {
      console.error("Errore caricamento bici:", bikeError);
      setToast({
        type: "error",
        message: `Errore caricamento bici: ${bikeError.message}`,
      });
    }

    if (customerError) {
      console.error("Errore caricamento clienti:", customerError);
      setToast({
        type: "error",
        message: `Errore caricamento clienti: ${customerError.message}`,
      });
    }

    setBikes((bikeData as BikeRow[]) || []);
    setCustomers((customerData as Customer[]) || []);
    setLoading(false);
  }

  function resetForm() {
    setForm({
      ...initialForm,
      customer_id: customerIdFromQuery || "",
    });
  }

  function parseMoney(value: string): number | null {
    const normalized = value.replace(",", ".").trim();
    if (!normalized) return null;
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
  }

  async function addBike() {
    if (!form.customer_id) {
      setToast({
        type: "error",
        message: "Seleziona un cliente.",
      });
      return;
    }

    if (!form.brand.trim()) {
      setToast({
        type: "error",
        message: "Il marchio è obbligatorio.",
      });
      return;
    }

    if (!form.model.trim()) {
      setToast({
        type: "error",
        message: "Il modello è obbligatorio.",
      });
      return;
    }

    if (!form.bike_type.trim()) {
      setToast({
        type: "error",
        message: "Il tipo bici è obbligatorio.",
      });
      return;
    }

    if (!form.serial_number.trim()) {
      setToast({
        type: "error",
        message: "Il numero telaio è obbligatorio.",
      });
      return;
    }

    setSaving(true);

    const payload = {
      customer_id: form.customer_id,
      brand: form.brand.trim(),
      model: form.model.trim(),
      color: form.color.trim() || null,
      bike_type: form.bike_type.trim(),
      serial_number: form.serial_number.trim().toUpperCase(),
      purchase_date: form.purchase_date || null,
      invoice_number: form.invoice_number.trim() || null,
      purchase_price: parseMoney(form.purchase_price),
      sale_price: parseMoney(form.sale_price),
      notes: form.notes.trim() || null,
    };

    const { error } = await supabase.from("bikes").insert(payload);

    if (error) {
      console.error("Errore inserimento bici:", error);
      setToast({
        type: "error",
        message: `Errore salvataggio bici: ${error.message}`,
      });
      setSaving(false);
      return;
    }

    setToast({
      type: "success",
      message: "Bici salvata correttamente.",
    });

    resetForm();
    await loadData();
    setSaving(false);
    setShowModal(false);

    if (customerIdFromQuery) {
      setTimeout(() => {
        router.push(`/customers/${customerIdFromQuery}`);
      }, 500);
    }
  }

  const selectedCustomerName = useMemo(() => {
    return customers.find((c) => c.id === form.customer_id)?.name || "";
  }, [customers, form.customer_id]);

  return (
    <div className="app-page-shell customer-bikes-page-shell">
      {toast && (
        <div
          style={{
            ...toastBase,
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

      <div className="page-header customer-bikes-header">
  <div className="page-header__left">
    <div className="apple-kicker">Bici clienti</div>
    <h1 className="apple-page-title">Bici</h1>
    <p className="apple-page-subtitle customer-bikes-subtitle">
      Tutte le bici cliente seguono lo stesso criterio dati della bici magazzino:
      anagrafica, economici, tracciabilità e collegamento cliente.
    </p>
  </div>

  <div className="page-header__right customer-bikes-header-actions">
    <button
      className="btn-secondary"
      onClick={() => {
        if (customerIdFromQuery) {
          router.push(`/customers/${customerIdFromQuery}`);
        } else {
          router.push("/customers");
        }
      }}
    >
      ← Torna indietro
    </button>

    <button
      className="btn-primary"
      onClick={() => {
        resetForm();
        setShowModal(true);
      }}
    >
      + Nuova bici
    </button>
  </div>
</div>

<div className="customer-bikes-list-card">
  <div className="customer-bikes-list-title">Lista bici</div>

  {loading ? (
    <div className="customer-bikes-empty">Caricamento bici...</div>
  ) : bikes.length === 0 ? (
    <div className="customer-bikes-empty">Non ci sono ancora bici registrate.</div>
  ) : (
    <div className="customer-bikes-table-wrap">
      <table className="customer-bikes-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Marchio</th>
            <th>Modello</th>
            <th>Tipo bici</th>
            <th>Numero telaio</th>
            <th>Acquisto</th>
            <th>Vendita</th>
          </tr>
        </thead>
        <tbody>
          {bikes.map((b) => (
            <tr key={b.id}>
              <td>{b.customers?.name || "-"}</td>
              <td>{b.brand || "-"}</td>
              <td>{b.model || "-"}</td>
              <td>{b.bike_type || "-"}</td>
              <td>{b.serial_number || "-"}</td>
              <td>
                {b.purchase_price !== null && b.purchase_price !== undefined
                  ? `€ ${Number(b.purchase_price).toFixed(2)}`
                  : "-"}
              </td>
              <td>
                {b.sale_price !== null && b.sale_price !== undefined
                  ? `€ ${Number(b.sale_price).toFixed(2)}`
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>

        {showModal && (
  <div className="customer-bike-modal-overlay">
    <div className="customer-bike-modal">
      <div className="customer-bike-modal__header">
        <h2 className="customer-bike-modal__title">Nuova bici</h2>

        <button
          className="customer-bike-modal__close"
          onClick={() => {
            setShowModal(false);
            resetForm();
            if (customerIdFromQuery) {
              router.push(`/customers/${customerIdFromQuery}`);
            }
          }}
        >
          ✕
        </button>
      </div>

      <div className="customer-bike-modal__divider" />

      <div className="customer-bike-modal__body">
        <div className="customer-bike-form-grid">
          <div className="customer-bike-field">
            <label className="customer-bike-label">Cliente *</label>
            <select
              className="apple-select"
              value={form.customer_id}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, customer_id: e.target.value }))
              }
              disabled={Boolean(customerIdFromQuery)}
            >
              <option value="">Seleziona cliente</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || "Cliente senza nome"}
                </option>
              ))}
            </select>
          </div>

          <div className="customer-bike-field">
            <label className="customer-bike-label">Marchio *</label>
            <input
              className="apple-input"
              placeholder="Marchio"
              value={form.brand}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, brand: e.target.value }))
              }
            />
          </div>

          <div className="customer-bike-field">
            <label className="customer-bike-label">Modello *</label>
            <input
              className="apple-input"
              placeholder="Modello"
              value={form.model}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, model: e.target.value }))
              }
            />
          </div>

          <div className="customer-bike-field">
            <label className="customer-bike-label">Colore</label>
            <input
              className="apple-input"
              placeholder="Colore"
              value={form.color}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, color: e.target.value }))
              }
            />
          </div>

          <div className="customer-bike-field">
            <label className="customer-bike-label">Tipo bici *</label>
            <select
              className="apple-select"
              value={form.bike_type}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, bike_type: e.target.value }))
              }
            >
              <option value="">Seleziona tipo bici</option>
              {BIKE_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="customer-bike-field">
            <label className="customer-bike-label">Numero telaio *</label>
            <input
              className="apple-input"
              placeholder="Numero telaio"
              value={form.serial_number}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  serial_number: e.target.value,
                }))
              }
            />
          </div>

          <div className="customer-bike-field">
            <label className="customer-bike-label">Data acquisto</label>
            <input
              type="date"
              className="apple-input"
              value={form.purchase_date}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  purchase_date: e.target.value,
                }))
              }
            />
          </div>

          <div className="customer-bike-field">
            <label className="customer-bike-label">Numero fattura</label>
            <input
              className="apple-input"
              placeholder="Numero fattura"
              value={form.invoice_number}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  invoice_number: e.target.value,
                }))
              }
            />
          </div>

          <div className="customer-bike-field">
            <label className="customer-bike-label">Prezzo acquisto</label>
            <input
              className="apple-input"
              placeholder="Prezzo acquisto"
              value={form.purchase_price}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  purchase_price: e.target.value,
                }))
              }
            />
          </div>

          <div className="customer-bike-field">
            <label className="customer-bike-label">Prezzo vendita</label>
            <input
              className="apple-input"
              placeholder="Prezzo vendita"
              value={form.sale_price}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  sale_price: e.target.value,
                }))
              }
            />
          </div>
        </div>

        <div className="customer-bike-notes-wrap">
          <div className="customer-bike-field">
            <label className="customer-bike-label">Note</label>
            <textarea
              className="apple-textarea customer-bike-textarea"
              placeholder="Note sulla bici"
              value={form.notes}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="customer-bike-info-box">
          Cliente collegato:{" "}
          <strong>{selectedCustomerName || "Seleziona cliente"}</strong>
        </div>
      </div>

      <div className="customer-bike-form-footer">
        <button className="btn-primary" onClick={addBike} disabled={saving}>
          {saving ? "Salvataggio..." : "Salva bici"}
        </button>

        <button
          className="btn-secondary"
          onClick={() => {
            setShowModal(false);
            resetForm();
            if (customerIdFromQuery) {
              router.push(`/customers/${customerIdFromQuery}`);
            }
          }}
        >
          Chiudi
        </button>
      </div>
    </div>
  </div>
)}
      
    </div>
  );
}

const loadingWrap: React.CSSProperties = {
  padding: 32,
  color: "#475569",
};

const header: React.CSSProperties = {
  maxWidth: 1280,
  margin: "0 auto 20px auto",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
};

const eyebrow: React.CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  marginBottom: 8,
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 34,
  fontWeight: 800,
  color: "#0f172a",
};

const subtitle: React.CSSProperties = {
  marginTop: 8,
  color: "#64748b",
  fontSize: 15,
  lineHeight: 1.5,
  maxWidth: 860,
};

const headerActions: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const card: React.CSSProperties = {
  maxWidth: 1280,
  margin: "0 auto 20px auto",
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  padding: 20,
  boxShadow: "0 10px 28px rgba(15,23,42,0.05)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: 16,
};

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 900,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  borderBottom: "1px solid #e2e8f0",
  color: "#64748b",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const td: React.CSSProperties = {
  padding: "14px",
  borderBottom: "1px solid #eef2f7",
  color: "#0f172a",
  fontSize: 14,
};

const emptyState: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 24,
  textAlign: "center",
  color: "#64748b",
};

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.46)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  zIndex: 1200,
  backdropFilter: "blur(4px)",
};

const modal: React.CSSProperties = {
  width: "100%",
  maxWidth: 1680,
  background: "#fff",
  borderRadius: 28,
  boxShadow: "0 26px 80px rgba(0,0,0,0.2)",
  border: "1px solid #e2e8f0",
  overflow: "hidden",
  padding: 0,
};

const modalHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "24px 40px",
};

const modalTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 800,
  color: "#0f172a",
};

const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  fontSize: 24,
  cursor: "pointer",
  color: "#111827",
};

const modalDivider: React.CSSProperties = {
  height: 1,
  background: "#e5e7eb",
  width: "100%",
  marginBottom: 0,
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 24,
  padding: "28px 40px 0 40px",
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
  width: "100%",
  minHeight: 62,
  padding: "16px 18px",
  borderRadius: 20,
  border: "1px solid #dbe2ea",
  fontSize: 18,
  outline: "none",
  background: "#fff",
};

const textarea: React.CSSProperties = {
  width: "calc(100% - 80px)",
  margin: "0 40px",
  minHeight: 120,
  padding: "16px 18px",
  borderRadius: 20,
  border: "1px solid #dbe2ea",
  fontSize: 18,
  outline: "none",
  background: "#fff",
  resize: "vertical",
};

const infoBox: React.CSSProperties = {
  margin: "24px 40px 0 40px",
  padding: "18px 20px",
  borderRadius: 20,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#64748b",
  fontSize: 16,
};

const primaryBtn: React.CSSProperties = {
  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
  color: "#fff",
  border: "none",
  padding: "18px 34px",
  borderRadius: 20,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 18,
  boxShadow: "0 12px 24px rgba(37,99,235,0.2)",
};

const secondaryBtn: React.CSSProperties = {
  background: "#e5e7eb",
  color: "#111827",
  border: "1px solid #d1d5db",
  padding: "18px 28px",
  borderRadius: 20,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 18,
};

const toastBase: React.CSSProperties = {
  position: "fixed",
  top: 24,
  right: 24,
  zIndex: 1300,
  padding: "14px 18px",
  borderRadius: 14,
  fontWeight: 800,
  boxShadow: "0 14px 32px rgba(15,23,42,0.16)",
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