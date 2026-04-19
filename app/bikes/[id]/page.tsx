"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type BikeType =
  | "Cargo"
  | "E-Cargo"
  | "City / Urban"
  | "E-City / Urban"
  | "MTB"
  | "Road"
  | "Gravel"
  | "Kids"
  | "Altro"
  | string;

type ToastType = "success" | "error" | "info";

type CustomerLite = {
  id: string;
  name: string | null;
};

type Bike = {
  id: string;
  customer_id: string | null;
  brand: string | null;
  model: string | null;
  serial: string | null;
  serial_number: string | null;
  bike_type: BikeType | null;
  color: string | null;
  created_at: string | null;
  purchase_date: string | null;
  invoice_number: string | null;
  purchase_price: number | null;
  sale_price: number | null;
  notes: string | null;
};

type WorkOrderBikeRelation = {
  brand?: string | null;
  model?: string | null;
  serial?: string | null;
  serial_number?: string | null;
  bike_type?: string | null;
} | null;

type WorkOrder = {
  id: string;
  status: string | null;
  created_at: string | null;
  notes: string | null;
  bikes?: WorkOrderBikeRelation;
};

const EMPTY_BIKE: Bike = {
  id: "",
  customer_id: null,
  brand: "",
  model: "",
  serial: "",
  serial_number: "",
  bike_type: "",
  color: "",
  created_at: null,
  purchase_date: null,
  invoice_number: "",
  purchase_price: null,
  sale_price: null,
  notes: "",
};

const BIKE_TYPE_OPTIONS: BikeType[] = [
  "Cargo",
  "E-Cargo",
  "City / Urban",
  "E-City / Urban",
  "MTB",
  "Road",
  "Gravel",
  "Kids",
  "Altro",
];

export default function BikeCustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bikeId = String(params?.id || "");

  const [bike, setBike] = useState<Bike>(EMPTY_BIKE);
  const [draft, setDraft] = useState<Bike>(EMPTY_BIKE);
  const [customer, setCustomer] = useState<CustomerLite | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [toast, setToast] = useState<{
    type: ToastType;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!bikeId) return;
    loadAll();
  }, [bikeId]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadAll() {
    setLoading(true);

    const { data, error } = await supabase
      .from("bikes")
      .select("*")
      .eq("id", bikeId)
      .single();

    if (error || !data) {
      console.error("Errore caricamento bici:", error);
      setToast({
        type: "error",
        message: `Errore caricamento bici: ${error?.message || "Bici non trovata"}`,
      });
      setLoading(false);
      return;
    }

    const loadedBike = {
      ...EMPTY_BIKE,
      ...(data as Bike),
    };

    setBike(loadedBike);
    setDraft(loadedBike);

    if (loadedBike.customer_id) {
      const { data: customerData } = await supabase
        .from("customers")
        .select("id,name")
        .eq("id", loadedBike.customer_id)
        .single();

      if (customerData) {
        setCustomer(customerData as CustomerLite);
      }
    } else {
      setCustomer(null);
    }

    const { data: woData, error: woError } = await supabase
      .from("work_orders")
      .select(
        `
        id,
        status,
        created_at,
        notes,
        bikes(
          brand,
          model,
          serial,
          serial_number,
          bike_type
        )
      `
      )
      .eq("bike_id", bikeId)
      .order("created_at", { ascending: false });

    if (woError) {
      console.error("Errore caricamento schede lavoro:", woError);
      setToast({
        type: "error",
        message: `Errore caricamento schede lavoro: ${woError.message}`,
      });
    } else {
      setWorkOrders((woData as WorkOrder[]) || []);
    }

    setLoading(false);
  }

  function updateField<K extends keyof Bike>(key: K, value: Bike[K]) {
    setDraft((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function normalizeText(value: string | null) {
    return String(value || "").trim() || null;
  }

  function normalizeNumber(value: number | null | undefined) {
    if (value === null || value === undefined || value === ("" as any)) return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }

  function getBikeSerialLabel(source: Bike) {
    return source.serial_number || source.serial || "-";
  }

  function getWorkOrderBikeLabel(bikeRel?: WorkOrderBikeRelation) {
    if (!bikeRel) return "Bici collegata";
    const brand = bikeRel.brand || "";
    const model = bikeRel.model || "";
    const serial = bikeRel.serial_number || bikeRel.serial || "";
    return [brand, model, serial].filter(Boolean).join(" · ") || "Bici collegata";
  }

  function formatCurrency(value: number | null | undefined) {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  }

  function formatStatus(status: string | null) {
    if (status === "open") return "Aperta";
    if (status === "working") return "In lavorazione";
    if (status === "closed") return "Chiusa";
    return status || "-";
  }

  function statusStyle(status: string | null): React.CSSProperties {
    if (status === "open") {
      return { background: "#e0f2fe", color: "#075985" };
    }
    if (status === "working") {
      return { background: "#fff7ed", color: "#c2410c" };
    }
    if (status === "closed") {
      return { background: "#e5e7eb", color: "#374151" };
    }
    return { background: "#f3f4f6", color: "#374151" };
  }

  async function saveBike() {
    if (!draft.brand?.trim()) {
      setToast({ type: "error", message: "Il marchio è obbligatorio." });
      return;
    }

    if (!draft.model?.trim()) {
      setToast({ type: "error", message: "Il modello è obbligatorio." });
      return;
    }

    const serialValue = draft.serial_number || draft.serial;
    if (!String(serialValue || "").trim()) {
      setToast({ type: "error", message: "Il numero telaio è obbligatorio." });
      return;
    }

    setSaving(true);

    const payload = {
      brand: normalizeText(draft.brand),
      model: normalizeText(draft.model),
      serial: normalizeText(draft.serial),
      serial_number: normalizeText(draft.serial_number || draft.serial),
      bike_type: normalizeText(draft.bike_type),
      color: normalizeText(draft.color),
      purchase_date: draft.purchase_date || null,
      invoice_number: normalizeText(draft.invoice_number),
      purchase_price: normalizeNumber(draft.purchase_price),
      sale_price: normalizeNumber(draft.sale_price),
      notes: normalizeText(draft.notes),
    };

    const { error } = await supabase.from("bikes").update(payload).eq("id", bikeId);

    if (error) {
      console.error("Errore salvataggio bici:", error);
      setToast({
        type: "error",
        message: `Errore salvataggio: ${error.message}`,
      });
      setSaving(false);
      return;
    }

    const updated = { ...bike, ...payload };
    setBike(updated);
    setDraft(updated);
    setEditMode(false);
    setSaving(false);

    setToast({
      type: "success",
      message: "Bici aggiornata correttamente.",
    });
  }

  function cancelEdit() {
    setDraft(bike);
    setEditMode(false);
  }

  async function deleteBike() {
    const ok = window.confirm(
      `Vuoi davvero eliminare la bici "${bike.brand || ""} ${bike.model || ""}"?`
    );

    if (!ok) return;

    setDeleting(true);

    const { error } = await supabase.from("bikes").delete().eq("id", bikeId);

    if (error) {
      console.error("Errore eliminazione bici:", error);
      setToast({
        type: "error",
        message: `Errore eliminazione: ${error.message}`,
      });
      setDeleting(false);
      return;
    }

    if (bike.customer_id) {
      router.push(`/customers/${bike.customer_id}`);
      return;
    }

    router.push("/bikes");
  }

  const current = editMode ? draft : bike;

  const fullCustomerName = customer?.name || "Cliente non assegnato";

  const isDirty = useMemo(() => {
    return JSON.stringify(bike) !== JSON.stringify(draft);
  }, [bike, draft]);

  if (loading) {
    return <div style={loadingWrap}>Caricamento bici...</div>;
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

      <div style={header}>
        <div>
          <div style={eyebrow}>Scheda bici cliente</div>
          <h1 style={title}>
            {current.brand || "Bici"} {current.model || ""}
          </h1>
          <p style={subtitle}>
            Gestisci i dati della bici cliente e visualizza le schede lavoro collegate.
          </p>
        </div>

        <div style={headerActions}>
          {bike.customer_id ? (
            <button
              style={secondaryBtn}
              onClick={() => router.push(`/customers/${bike.customer_id}`)}
            >
              ← Torna al cliente
            </button>
          ) : (
            <button style={secondaryBtn} onClick={() => router.push("/bikes")}>
              ← Torna alle bici
            </button>
          )}

          {!editMode ? (
            <button style={primaryBtn} onClick={() => setEditMode(true)}>
              Modifica bici
            </button>
          ) : (
            <>
              <button style={secondaryBtn} onClick={cancelEdit} disabled={saving}>
                Annulla
              </button>
              <button
                style={{
                  ...primaryBtn,
                  opacity: saving || !isDirty ? 0.7 : 1,
                }}
                onClick={saveBike}
                disabled={saving || !isDirty}
              >
                {saving ? "Salvataggio..." : "Salva modifiche"}
              </button>
            </>
          )}
        </div>
      </div>

      <div style={heroCard}>
        <div style={heroLeft}>
          <div style={avatar}>🚲</div>
          <div>
            <div style={heroNameRow}>
              <div style={heroName}>
                {current.brand || "-"} {current.model || ""}
              </div>
              <span style={typeBadge}>{current.bike_type || "Tipo non definito"}</span>
            </div>

            <div style={heroMeta}>Telaio: {getBikeSerialLabel(current)}</div>
            <div style={heroMeta}>Cliente associato: {fullCustomerName}</div>
          </div>
        </div>

        <div style={heroSummary}>
          <div style={summaryBox}>
            <div style={summaryLabel}>Colore</div>
            <div style={summaryValue}>{current.color || "-"}</div>
          </div>
          <div style={summaryBox}>
            <div style={summaryLabel}>Acquisto</div>
            <div style={summaryValue}>{formatCurrency(current.purchase_price)}</div>
          </div>
          <div style={summaryBox}>
            <div style={summaryLabel}>Vendita</div>
            <div style={summaryValue}>{formatCurrency(current.sale_price)}</div>
          </div>
        </div>
      </div>

      <div style={grid}>
        <div style={card}>
          <div style={sectionTitle}>Dati bici</div>

          <div style={formGrid2}>
            <Field label="Marchio">
              {editMode ? (
                <input
                  style={input}
                  value={draft.brand || ""}
                  onChange={(e) => updateField("brand", e.target.value)}
                />
              ) : (
                <ValueBox>{bike.brand || "-"}</ValueBox>
              )}
            </Field>

            <Field label="Modello">
              {editMode ? (
                <input
                  style={input}
                  value={draft.model || ""}
                  onChange={(e) => updateField("model", e.target.value)}
                />
              ) : (
                <ValueBox>{bike.model || "-"}</ValueBox>
              )}
            </Field>
          </div>

          <div style={formGrid2}>
            <Field label="Tipo bici">
              {editMode ? (
                <select
                  style={input}
                  value={draft.bike_type || ""}
                  onChange={(e) => updateField("bike_type", e.target.value)}
                >
                  <option value="">Seleziona tipo</option>
                  {BIKE_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <ValueBox>{bike.bike_type || "-"}</ValueBox>
              )}
            </Field>

            <Field label="Colore">
              {editMode ? (
                <input
                  style={input}
                  value={draft.color || ""}
                  onChange={(e) => updateField("color", e.target.value)}
                />
              ) : (
                <ValueBox>{bike.color || "-"}</ValueBox>
              )}
            </Field>
          </div>

          <div style={formGrid2}>
            <Field label="Numero telaio">
              {editMode ? (
                <input
                  style={input}
                  value={draft.serial_number || draft.serial || ""}
                  onChange={(e) => {
                    updateField("serial_number", e.target.value);
                    updateField("serial", e.target.value);
                  }}
                />
              ) : (
                <ValueBox>{getBikeSerialLabel(bike)}</ValueBox>
              )}
            </Field>

            <Field label="Data acquisto">
              {editMode ? (
                <input
                  type="date"
                  style={input}
                  value={draft.purchase_date || ""}
                  onChange={(e) => updateField("purchase_date", e.target.value)}
                />
              ) : (
                <ValueBox>{bike.purchase_date || "-"}</ValueBox>
              )}
            </Field>
          </div>
        </div>

        <div style={card}>
          <div style={sectionTitle}>Dati economici</div>

          <div style={formGrid2}>
            <Field label="Numero fattura">
              {editMode ? (
                <input
                  style={input}
                  value={draft.invoice_number || ""}
                  onChange={(e) => updateField("invoice_number", e.target.value)}
                />
              ) : (
                <ValueBox>{bike.invoice_number || "-"}</ValueBox>
              )}
            </Field>

            <Field label="Prezzo acquisto">
              {editMode ? (
                <input
                  type="number"
                  step="0.01"
                  style={input}
                  value={draft.purchase_price ?? ""}
                  onChange={(e) =>
                    updateField(
                      "purchase_price",
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                />
              ) : (
                <ValueBox>{formatCurrency(bike.purchase_price)}</ValueBox>
              )}
            </Field>
          </div>

          <div style={formGrid2}>
            <Field label="Prezzo vendita">
              {editMode ? (
                <input
                  type="number"
                  step="0.01"
                  style={input}
                  value={draft.sale_price ?? ""}
                  onChange={(e) =>
                    updateField(
                      "sale_price",
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                />
              ) : (
                <ValueBox>{formatCurrency(bike.sale_price)}</ValueBox>
              )}
            </Field>

            <Field label="Cliente assegnato">
              <ValueBox>{fullCustomerName}</ValueBox>
            </Field>
          </div>

          <Field label="Note">
            {editMode ? (
              <textarea
                style={textarea}
                value={draft.notes || ""}
                onChange={(e) => updateField("notes", e.target.value)}
              />
            ) : (
              <ValueBox multiline>{bike.notes || "-"}</ValueBox>
            )}
          </Field>
        </div>

        <div style={wideCard}>
          <div style={sectionTitle}>Schede lavoro collegate</div>

          {workOrders.length === 0 ? (
            <div style={emptyState}>Nessuna scheda lavoro collegata a questa bici.</div>
          ) : (
            <div style={listWrap}>
              {workOrders.map((wo) => (
                <button
                  key={wo.id}
                  style={listRowButton}
                  onClick={() => {
                    if (wo.status === "closed") {
                      router.push(`/workorders/${wo.id}/report`);
                    } else {
                      router.push(`/workorders/${wo.id}`);
                    }
                  }}
                >
                  <div style={listMain}>
                    <div style={rowTitle}>{getWorkOrderBikeLabel(wo.bikes)}</div>
                    <div style={rowSub}>{wo.notes || "Scheda lavoro collegata"}</div>
                    <div style={rowMeta}>
                      Data:{" "}
                      {wo.created_at
                        ? new Date(wo.created_at).toLocaleDateString("it-IT")
                        : "-"}
                    </div>
                  </div>

                  <div style={listRight}>
                    <span style={{ ...statusBadge, ...statusStyle(wo.status) }}>
                      {formatStatus(wo.status)}
                    </span>
                    <div style={openTag}>Apri scheda</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={footerBar}>
        <button
          style={dangerBtn}
          onClick={deleteBike}
          disabled={saving || deleting}
        >
          {deleting ? "Eliminazione..." : "Elimina bici"}
        </button>

        <div style={footerActions}>
          {!editMode ? (
            <button style={primaryBtn} onClick={() => setEditMode(true)}>
              Modifica bici
            </button>
          ) : (
            <>
              <button style={secondaryBtn} onClick={cancelEdit} disabled={saving}>
                Annulla
              </button>
              <button
                style={{
                  ...primaryBtn,
                  opacity: saving || !isDirty ? 0.7 : 1,
                }}
                onClick={saveBike}
                disabled={saving || !isDirty}
              >
                {saving ? "Salvataggio..." : "Salva modifiche"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={field}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function ValueBox({
  children,
  multiline = false,
}: {
  children: React.ReactNode;
  multiline?: boolean;
}) {
  return (
    <div
      style={{
        ...valueBox,
        ...(multiline ? valueBoxMultiline : {}),
      }}
    >
      {children}
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: 24,
};

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
};

const headerActions: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const heroCard: React.CSSProperties = {
  maxWidth: 1280,
  margin: "0 auto 20px auto",
  background: "linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)",
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  padding: 22,
  boxShadow: "0 10px 28px rgba(15,23,42,0.05)",
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr",
  gap: 18,
};

const heroLeft: React.CSSProperties = {
  display: "flex",
  gap: 16,
  alignItems: "flex-start",
};

const avatar: React.CSSProperties = {
  width: 62,
  height: 62,
  borderRadius: 18,
  background: "#dbeafe",
  color: "#1d4ed8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 26,
  fontWeight: 800,
  flexShrink: 0,
};

const heroNameRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 8,
};

const heroName: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: "#0f172a",
  lineHeight: 1.2,
};

const heroMeta: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  marginTop: 4,
  wordBreak: "break-word",
};

const typeBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
};

const heroSummary: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const summaryBox: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 16,
};

const summaryLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  marginBottom: 6,
};

const summaryValue: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "#0f172a",
  wordBreak: "break-word",
};

const grid: React.CSSProperties = {
  maxWidth: 1280,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
  gap: 20,
};

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 20,
  boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
};

const wideCard: React.CSSProperties = {
  gridColumn: "1 / -1",
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 20,
  boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: 18,
};

const formGrid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
  marginBottom: 14,
};

const field: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  marginBottom: 14,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#475569",
  marginBottom: 8,
  fontWeight: 700,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #dbe2ea",
  fontSize: 14,
  outline: "none",
  background: "#fff",
};

const textarea: React.CSSProperties = {
  width: "100%",
  minHeight: 110,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #dbe2ea",
  fontSize: 14,
  outline: "none",
  background: "#fff",
  resize: "vertical",
};

const valueBox: React.CSSProperties = {
  width: "100%",
  minHeight: 48,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  fontSize: 14,
  color: "#0f172a",
  background: "#f8fafc",
  display: "flex",
  alignItems: "center",
};

const valueBoxMultiline: React.CSSProperties = {
  alignItems: "flex-start",
  minHeight: 90,
  whiteSpace: "pre-wrap",
};

const listWrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const listRowButton: React.CSSProperties = {
  width: "100%",
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  textAlign: "left",
  cursor: "pointer",
};

const listMain: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const rowTitle: React.CSSProperties = {
  fontWeight: 800,
  color: "#0f172a",
  fontSize: 16,
  lineHeight: 1.35,
};

const rowSub: React.CSSProperties = {
  marginTop: 6,
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.45,
};

const rowMeta: React.CSSProperties = {
  marginTop: 6,
  color: "#94a3b8",
  fontSize: 12,
};

const listRight: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  alignItems: "flex-end",
};

const statusBadge: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
};

const openTag: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#2563eb",
};

const emptyState: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 24,
  textAlign: "center",
  color: "#64748b",
};

const footerBar: React.CSSProperties = {
  maxWidth: 1280,
  margin: "20px auto 0 auto",
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
};

const footerActions: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
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
};

const secondaryBtn: React.CSSProperties = {
  background: "#fff",
  color: "#0f172a",
  border: "1px solid #dbe2ea",
  padding: "12px 18px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
};

const dangerBtn: React.CSSProperties = {
  background: "#fff1f2",
  color: "#be123c",
  border: "1px solid #fecdd3",
  padding: "12px 18px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
};

const toastStyle: React.CSSProperties = {
  position: "fixed",
  top: 24,
  right: 24,
  zIndex: 1100,
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