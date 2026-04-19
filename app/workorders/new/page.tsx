"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

type Customer = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
};

type Bike = {
  id: string;
  customer_id: string;
  brand: string | null;
  model: string | null;
  serial: string | null;
  color: string | null;
};

type ToastType = "success" | "error" | "info";

export default function NewWorkOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const customerIdFromQuery =
    searchParams.get("customer_id") ||
    searchParams.get("customerId") ||
    "";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [bikes, setBikes] = useState<Bike[]>([]);
  const [selectedBike, setSelectedBike] = useState<Bike | null>(null);

  const [note, setNote] = useState("");

  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingBikes, setLoadingBikes] = useState(false);
  const [creating, setCreating] = useState(false);
  const [allowCustomerPrefill, setAllowCustomerPrefill] = useState(true);

  const [toast, setToast] = useState<{
    type: ToastType;
    message: string;
  } | null>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (!allowCustomerPrefill) return;
    if (loadingCustomers) return;
    if (!customerIdFromQuery) return;
    if (selectedCustomer) return;

    const customerFromQuery = customers.find((c) => c.id === customerIdFromQuery);

    if (!customerFromQuery) return;

    selectCustomer(customerFromQuery);
  }, [
    allowCustomerPrefill,
    loadingCustomers,
    customerIdFromQuery,
    customers,
    selectedCustomer,
  ]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadCustomers() {
    setLoadingCustomers(true);

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("name");

    if (error) {
      console.error("Errore caricamento clienti:", error);
      setToast({
        type: "error",
        message: `Errore caricamento clienti: ${error.message}`,
      });
      setLoadingCustomers(false);
      return;
    }

    setCustomers((data as Customer[]) || []);
    setLoadingCustomers(false);
  }

  async function selectCustomer(c: Customer) {
    setSelectedCustomer(c);
    setSearch(c.name || "");
    setSelectedBike(null);
    setLoadingBikes(true);

    const { data, error } = await supabase
      .from("bikes")
      .select("*")
      .eq("customer_id", c.id)
      .order("brand");

    if (error) {
      console.error("Errore caricamento bici cliente:", error);
      setToast({
        type: "error",
        message: `Errore caricamento bici: ${error.message}`,
      });
      setBikes([]);
      setLoadingBikes(false);
      return;
    }

    setBikes((data as Bike[]) || []);
    setLoadingBikes(false);
  }

  async function createWorkOrder() {
    if (!selectedCustomer) {
      setToast({
        type: "error",
        message: "Seleziona cliente prima di creare la scheda.",
      });
      return;
    }

    if (!selectedBike) {
      setToast({
        type: "error",
        message: "Seleziona bici prima di creare la scheda.",
      });
      return;
    }

    setCreating(true);

    const { data, error } = await supabase
      .from("work_orders")
      .insert({
        customer_id: selectedCustomer.id,
        bike_id: selectedBike.id,
        notes: note.trim() || null,
        status: "open",
      })
      .select()
      .single();

    if (error) {
      console.error("Errore creazione scheda lavoro:", error);
      setToast({
        type: "error",
        message: `Errore creazione scheda: ${error.message}`,
      });
      setCreating(false);
      return;
    }

    setToast({
      type: "success",
      message: "Scheda lavoro creata correttamente.",
    });

    router.push(`/workorders/${data.id}`);
  }

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (q.length < 2) return [];

    return customers.filter((c) => {
      const text = [c.name || "", c.phone || "", c.email || ""]
        .join(" ")
        .toLowerCase();

      return text.includes(q);
    });
  }, [customers, search]);

  return (
    <div style={page}>
      {toast && (
        <div
          className={`workorder-new-toast ${toast.type === "success"
              ? "workorder-new-toast--success"
              : toast.type === "error"
                ? "workorder-new-toast--error"
                : "workorder-new-toast--info"
            }`}
        >
          {toast.message}
        </div>
      )}

      <div className="workorder-new-shell">
        <div className="workorder-new-topbar">
          <button className="btn-secondary workorder-new-back-btn" onClick={() => router.push("/workorders")}>
            ← Torna alle schede
          </button>
        </div>

        <div className="workorder-new-hero">
          <div>
            <div className="apple-kicker">Officina</div>
            <h1 className="apple-page-title">Nuova scheda lavoro</h1>
            <p className="apple-page-subtitle workorder-new-subtitle">
              Cerca il cliente, seleziona la bici corretta e crea una nuova
              lavorazione in pochi passaggi.
            </p>
          </div>
        </div>

        <div className="workorder-new-section">
          {!selectedCustomer && (
            <>
              <div className="workorder-new-section-title">1. Seleziona cliente</div>
              <div className="workorder-new-section-text">
                Cerca per nome, telefono o email.
              </div>

              <div className="workorder-new-search-row">
                <div className="workorder-new-search-field">
                  <Search size={18} strokeWidth={2} className="workorder-new-search-icon" />
                  <input
                    className="apple-input workorder-new-search workorder-new-search-input"
                    placeholder="Cerca cliente..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setSelectedCustomer(null);
                      setSelectedBike(null);
                      setBikes([]);
                    }}
                  />
                </div>

                {customerIdFromQuery && (
                  <button
                    type="button"
                    className="btn-secondary workorder-new-search-close"
                    onClick={() => {
                      setAllowCustomerPrefill(true);
                      setSearch("");

                      const customerFromQuery = customers.find(
                        (c) => c.id === customerIdFromQuery
                      );

                      if (customerFromQuery) {
                        void selectCustomer(customerFromQuery);
                      }
                    }}
                    aria-label="Chiudi ricerca cliente"
                    title="Chiudi"
                  >
                    <X size={18} strokeWidth={2} />
                  </button>
                )}
              </div>

              {loadingCustomers ? (
                <div className="workorder-new-helper">Caricamento clienti...</div>
              ) : results.length > 0 ? (
                <div className="workorder-new-results-grid">
                  {results.map((c) => (
                    <button
                      key={c.id}
                      className="workorder-new-customer-card"
                      onClick={() => selectCustomer(c)}
                    >
                      <div className="workorder-new-customer-name">{c.name || "-"}</div>
                      <div className="workorder-new-customer-info">📞 {c.phone || "-"}</div>
                      <div className="workorder-new-customer-info">✉️ {c.email || "-"}</div>
                    </button>
                  ))}
                </div>
              ) : search.trim().length >= 2 ? (
                <div className="workorder-new-helper">Nessun cliente trovato.</div>
              ) : (
                <div className="workorder-new-helper">Scrivi almeno 2 caratteri per iniziare.</div>
              )}
            </>
          )}
        </div>

        {selectedCustomer && (
          <div className="workorder-new-selected-box">
            <div className="workorder-new-selected-header">
              <div className="workorder-new-selected-avatar">
                {(selectedCustomer.name || "?").charAt(0).toUpperCase()}
              </div>

              <div>
                <div className="workorder-new-selected-title">{selectedCustomer.name}</div>
                <div className="workorder-new-customer-info">📞 {selectedCustomer.phone || "-"}</div>
                <div className="workorder-new-customer-info">✉️ {selectedCustomer.email || "-"}</div>
              </div>
            </div>

            <button
              className="btn-secondary workorder-new-change-btn"
              onClick={() => {
                setAllowCustomerPrefill(false);
                setSelectedCustomer(null);
                setSelectedBike(null);
                setBikes([]);
                setSearch("");
              }}
            >
              Cambia cliente
            </button>
          </div>
        )}

        {selectedCustomer && (
          <div className="workorder-new-section">
            <div className="workorder-new-section-title">2. Seleziona bici</div>
            <div className="workorder-new-section-text">
              Scegli la bici del cliente da associare alla lavorazione.
            </div>

            {loadingBikes ? (
              <div className="workorder-new-helper">Caricamento bici cliente...</div>
            ) : bikes.length === 0 ? (
              <div className="workorder-new-helper">
                Questo cliente non ha bici registrate.
              </div>
            ) : (
              <div className="workorder-new-bike-grid">
                {bikes.map((b) => {
                  const active = selectedBike?.id === b.id;

                  return (
                    <button
                      key={b.id}
                      className={`workorder-new-bike-card${active ? " is-active" : ""}`}
                      onClick={() => setSelectedBike(b)}
                    >
                      <div className="workorder-new-bike-title">
                        🚲 {b.brand || "-"} {b.model || ""}
                      </div>

                      <div className="workorder-new-bike-meta-grid">
                        <div>
                          <span className="workorder-new-bike-meta-label">Telaio</span>
                          <span className="workorder-new-bike-meta-value">{b.serial || "-"}</span>
                        </div>

                        <div>
                          <span className="workorder-new-bike-meta-label">Colore</span>
                          <span className="workorder-new-bike-meta-value">{b.color || "-"}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="workorder-new-section">
          <div className="workorder-new-section-title">3. Note lavoro</div>
          <div className="workorder-new-section-text">
            Inserisci eventuali indicazioni iniziali o richiesta del cliente.
          </div>

          <textarea
            className="apple-textarea workorder-new-textarea"
            rows={5}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Descrivi il problema, gli interventi richiesti o le note iniziali..."
          />
        </div>

        <div className="workorder-new-summary-card">
          <div className="workorder-new-summary-title">Riepilogo scheda</div>

          <div className="workorder-new-summary-row">
            <span>Cliente</span>
            <strong>{selectedCustomer?.name || "Non selezionato"}</strong>
          </div>

          <div className="workorder-new-summary-row">
            <span>Bici</span>
            <strong>
              {selectedBike
                ? `${selectedBike.brand || "-"} ${selectedBike.model || ""}`
                : "Non selezionata"}
            </strong>
          </div>

          <div className="workorder-new-summary-row">
            <span>Stato iniziale</span>
            <strong>Aperta</strong>
          </div>
        </div>

        <div className="workorder-new-footer">
          <button
            className="btn-secondary"
            onClick={() =>
              router.push(
                customerIdFromQuery ? `/customers/${customerIdFromQuery}` : "/workorders"
              )
            }
            disabled={creating}
          >
            Annulla
          </button>

          <button
            className="btn-primary workorder-new-create-btn"
            onClick={createWorkOrder}
            disabled={creating}
          >
            {creating ? "Creazione..." : "Crea scheda lavoro"}
          </button>
        </div>
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
  background: "#f8fafc",
  minHeight: "100vh",
  padding: 32,
};

const container: React.CSSProperties = {
  background: "white",
  padding: 32,
  borderRadius: 24,
  width: "100%",
  maxWidth: 900,
  margin: "0 auto",
  boxShadow: "0 16px 40px rgba(15,23,42,0.08)",
  display: "flex",
  flexDirection: "column",
  gap: 24,
};

const topBar: React.CSSProperties = {
  marginBottom: -8,
};

const backBtn: React.CSSProperties = {
  background: "#fff",
  color: "#0f172a",
  border: "1px solid #dbe2ea",
  padding: "10px 14px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const hero: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
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
};

const section: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "#0f172a",
};

const sectionText: React.CSSProperties = {
  fontSize: 14,
  color: "#64748b",
};

const input: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: "1px solid #dbe2ea",
  fontSize: 14,
  outline: "none",
};

const textarea: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: "1px solid #dbe2ea",
  fontSize: 14,
  outline: "none",
  resize: "vertical",
};

const resultsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const customerCard: React.CSSProperties = {
  padding: 14,
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  cursor: "pointer",
  transition: "all 0.2s",
  background: "#fff",
  textAlign: "left",
};

const helperBox: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 16,
  color: "#64748b",
  fontSize: 14,
};

const selectedCustomerBox: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  background: "#f8fbff",
  border: "1px solid #bfdbfe",
  padding: 18,
  borderRadius: 18,
  flexWrap: "wrap",
};

const selectedHeader: React.CSSProperties = {
  display: "flex",
  gap: 14,
  alignItems: "center",
};

const selectedAvatar: React.CSSProperties = {
  width: 50,
  height: 50,
  borderRadius: 14,
  background: "#dbeafe",
  color: "#1d4ed8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  fontSize: 20,
};

const selectedTitle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: 4,
};

const changeBtn: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #dbe2ea",
  padding: "10px 14px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const customerName: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 15,
  color: "#0f172a",
  marginBottom: 6,
};

const customerInfo: React.CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  marginTop: 2,
};

const bikeGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
};

const bikeCard: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  padding: 16,
  borderRadius: 16,
  cursor: "pointer",
  transition: "all 0.2s",
  background: "#fff",
  textAlign: "left",
};

const bikeCardActive: React.CSSProperties = {
  border: "2px solid #2563eb",
  background: "#eff6ff",
  boxShadow: "0 10px 24px rgba(37,99,235,0.12)",
};

const bikeTitle: React.CSSProperties = {
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: 12,
};

const bikeMetaGrid: React.CSSProperties = {
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

const summaryCard: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
};

const summaryTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: 14,
};

const summaryRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 0",
  borderBottom: "1px solid #eef2f7",
  color: "#334155",
};

const footer: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  marginTop: 8,
  flexWrap: "wrap",
};

const secondaryBtn: React.CSSProperties = {
  padding: "12px 16px",
  border: "1px solid #d1d5db",
  background: "#f8fafc",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
};

const createBtn: React.CSSProperties = {
  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
  color: "white",
  border: "none",
  padding: "14px 18px",
  borderRadius: 12,
  fontWeight: 700,
  fontSize: 15,
  boxShadow: "0 12px 24px rgba(37,99,235,0.2)",
};