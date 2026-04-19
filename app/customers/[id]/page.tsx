"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CustomerType = "private" | "company";
type ToastType = "success" | "error" | "info";

type Customer = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string | null;
  customer_type: CustomerType | null;
  vat_number: string | null;
  tax_code: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  province: string | null;
  country: string | null;
  address_notes: string | null;
  contact_name: string | null;
  pec: string | null;
  iban: string | null;
  sdi_code: string | null;
  biga_race: boolean | null;
  biga_adventure: boolean | null;
  biga_love: boolean | null;
};

type CustomerBike = {
  id: string;
  customer_id: string | null;
  brand: string | null;
  model: string | null;
  serial: string | null;
  serial_number: string | null;
  bike_type: string | null;
  color: string | null;
  notes: string | null;
  purchase_date: string | null;
  invoice_number: string | null;
  purchase_price: number | null;
  sale_price: number | null;
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
  bike_id?: string | null;
  bikes?: WorkOrderBikeRelation;
};

const EMPTY_CUSTOMER: Customer = {
  id: "",
  name: "",
  phone: "",
  email: "",
  notes: "",
  created_at: null,
  customer_type: "private",
  vat_number: "",
  tax_code: "",
  address: "",
  city: "",
  zip: "",
  province: "",
  country: "Italia",
  address_notes: "",
  contact_name: "",
  pec: "",
  iban: "",
  sdi_code: "",
  biga_race: false,
  biga_adventure: false,
  biga_love: false,
};

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = String(params?.id || "");

  const [customer, setCustomer] = useState<Customer>(EMPTY_CUSTOMER);
  const [draft, setDraft] = useState<Customer>(EMPTY_CUSTOMER);

  const [bikes, setBikes] = useState<CustomerBike[]>([]);
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
    if (!customerId) return;
    loadAll();
  }, [customerId]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadCustomer(), loadBikes(), loadWorkOrders()]);
    setLoading(false);
  }

  async function loadCustomer() {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    if (error) {
      console.error("Errore caricamento cliente:", error);
      setToast({
        type: "error",
        message: `Errore caricamento cliente: ${error.message}`,
      });
      return;
    }

    const loaded = {
      ...EMPTY_CUSTOMER,
      ...(data as Customer),
      biga_race: Boolean((data as any)?.biga_race),
      biga_adventure: Boolean((data as any)?.biga_adventure),
      biga_love: Boolean((data as any)?.biga_love),
    };

    setCustomer(loaded);
    setDraft(loaded);
  }

  async function loadBikes() {
    const { data, error } = await supabase
      .from("bikes")
      .select(`
        id,
        customer_id,
        brand,
        model,
        serial,
        serial_number,
        bike_type,
        color,
        notes,
        purchase_date,
        invoice_number,
        purchase_price,
        sale_price
      `)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Errore caricamento bici:", error);
      setToast({
        type: "error",
        message: `Errore caricamento bici: ${error.message}`,
      });
      return;
    }

    setBikes((data as CustomerBike[]) || []);
  }

  async function loadWorkOrders() {
    const { data, error } = await supabase
      .from("work_orders")
      .select(
        `
        id,
        status,
        created_at,
        notes,
        bike_id,
        bikes(
          brand,
          model,
          serial,
          serial_number,
          bike_type
        )
      `
      )
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Errore caricamento schede lavoro:", error);
      setToast({
        type: "error",
        message: `Errore caricamento schede lavoro: ${error.message}`,
      });
      return;
    }

    setWorkOrders((data as WorkOrder[]) || []);
  }

  function updateField<K extends keyof Customer>(key: K, value: Customer[K]) {
    setDraft((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function normalizeEmail(value: string | null) {
    return String(value || "").trim().toLowerCase() || null;
  }

  function normalizeUpper(value: string | null) {
    return String(value || "").trim().toUpperCase() || null;
  }

  function normalizeText(value: string | null) {
    return String(value || "").trim() || null;
  }

  function getTypeLabel(type: CustomerType | null) {
    return type === "company" ? "Azienda" : "Privato";
  }

  function formatStatus(status: string | null) {
    if (status === "open") return "Aperta";
    if (status === "working") return "In lavorazione";
    if (status === "closed") return "Chiusa";
    return status || "-";
  }

  function getStatusBadgeClass(status: string | null) {
    if (status === "open") return "customer-detail-status customer-detail-status--open";
    if (status === "working") return "customer-detail-status customer-detail-status--working";
    if (status === "closed") return "customer-detail-status customer-detail-status--closed";
    return "customer-detail-status customer-detail-status--default";
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

  function getBikeSerialLabel(bike: CustomerBike) {
    return bike.serial_number || bike.serial || "-";
  }

  function getBikeTypeLabel(bike: CustomerBike) {
    return bike.bike_type || "-";
  }

  function getWorkOrderBikeLabel(bike?: WorkOrderBikeRelation) {
    if (!bike) return "Bici non collegata";

    const brand = bike.brand || "";
    const model = bike.model || "";
    const serial = bike.serial_number || bike.serial || "";

    const firstPart = [brand, model].filter(Boolean).join(" ").trim();
    if (firstPart && serial) return `${firstPart} · ${serial}`;
    if (firstPart) return firstPart;
    if (serial) return serial;

    return "Bici non collegata";
  }

  function formatCurrency(value: number | null | undefined) {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  }

  async function saveCustomer() {
    if (!draft.name?.trim()) {
      setToast({
        type: "error",
        message: "Il nome / denominazione cliente è obbligatorio.",
      });
      return;
    }

    setSaving(true);

    const payload = {
      name: draft.name.trim(),
      phone: normalizeText(draft.phone),
      email: normalizeEmail(draft.email),
      notes: normalizeText(draft.notes),
      customer_type: draft.customer_type || "private",
      vat_number: normalizeUpper(draft.vat_number),
      tax_code: normalizeUpper(draft.tax_code),
      address: normalizeText(draft.address),
      city: normalizeText(draft.city),
      zip: normalizeText(draft.zip),
      province: normalizeUpper(draft.province),
      country: normalizeText(draft.country),
      address_notes: normalizeText(draft.address_notes),
      contact_name: normalizeText(draft.contact_name),
      pec: normalizeEmail(draft.pec),
      iban: normalizeUpper(draft.iban),
      sdi_code: normalizeUpper(draft.sdi_code),
      biga_race: Boolean(draft.biga_race),
      biga_adventure: Boolean(draft.biga_adventure),
      biga_love: Boolean(draft.biga_love),
    };

    const { error } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", customerId);

    if (error) {
      console.error("Errore salvataggio cliente:", error);
      setToast({
        type: "error",
        message: `Errore salvataggio: ${error.message}`,
      });
      setSaving(false);
      return;
    }

    setCustomer((prev) => ({
      ...prev,
      ...payload,
    }));

    setEditMode(false);
    setSaving(false);

    setToast({
      type: "success",
      message: "Cliente aggiornato correttamente.",
    });
  }

  function cancelEdit() {
    setDraft(customer);
    setEditMode(false);
  }

  async function deleteCustomer() {
    const ok = window.confirm(
      `Vuoi davvero eliminare il cliente "${customer.name || "senza nome"}"?`
    );

    if (!ok) return;

    setDeleting(true);

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", customerId);

    if (error) {
      console.error("Errore eliminazione cliente:", error);
      setToast({
        type: "error",
        message: `Errore eliminazione: ${error.message}`,
      });
      setDeleting(false);
      return;
    }

    router.push("/customers");
  }

  const fullAddress = useMemo(() => {
    const source = editMode ? draft : customer;

    return [
      source.address || "",
      source.address_notes || "",
      [
        source.zip || "",
        source.city || "",
        source.province ? `(${source.province})` : "",
      ]
        .filter(Boolean)
        .join(" "),
      source.country || "",
    ]
      .filter(Boolean)
      .join(", ");
  }, [customer, draft, editMode]);

  const current = editMode ? draft : customer;

  if (loading) {
    return <div className="apple-empty">Caricamento scheda cliente...</div>;
  }

  return (
    <div className="app-page-shell">
      {toast && (
        <div
          className={`toast ${toast.type === "success"
            ? "toastSuccess"
            : toast.type === "error"
              ? "toastError"
              : "toastInfo"
            }`}
        >
          {toast.message}
        </div>
      )}

      <div className="page-header customer-detail-header">
        <div className="page-header__left">
          <div className="apple-kicker">Scheda cliente</div>
          <h1 className="apple-page-title customer-detail-title">
            {current.name || "Cliente"}
          </h1>
          <p className="apple-page-subtitle customer-detail-subtitle">
            Visualizza tutti i dati del cliente, le bici associate e le schede
            lavoro collegate.
          </p>
        </div>

        <div className="page-header__right customer-detail-header-actions">
          <button className="btn-secondary" onClick={() => router.push("/customers")}>
            ← Torna ai clienti
          </button>

          <button
            className="btn-secondary"
            onClick={() => router.push(`/bikes?customerId=${customerId}`)}
          >
            + Aggiungi bici cliente
          </button>

          <button
            className="btn-secondary"
            onClick={() => router.push(`/workorders/new?customerId=${customerId}`)}
          >
            + Nuova scheda lavoro
          </button>

          {!editMode ? (
            <button className="btn-primary" onClick={() => setEditMode(true)}>
              Modifica cliente
            </button>
          ) : (
            <>
              <button className="btn-secondary" onClick={cancelEdit} disabled={saving}>
                Annulla modifica
              </button>
              <button className="btn-primary" onClick={saveCustomer} disabled={saving}>
                {saving ? "Salvataggio..." : "Salva modifiche"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="customer-detail-hero">
        <div className="customer-detail-hero__left">
          <div className="customer-detail-avatar">
            {(current.name || "?").charAt(0).toUpperCase()}
          </div>

          <div className="customer-detail-hero__content">
            <div className="customer-detail-name-row">
              <div className="customer-detail-name">{current.name || "-"}</div>
              <span
                className={
                  current.customer_type === "company"
                    ? "badge badge-purple"
                    : "badge badge-blue"
                }
              >
                {getTypeLabel(current.customer_type)}
              </span>
            </div>

            <div className="customer-detail-meta-box">
  <div className="customer-detail-meta customer-detail-meta--inverse">
    ID cliente: {current.id}
  </div>
  <div className="customer-detail-meta customer-detail-meta--inverse">
    Creato il{" "}
    {current.created_at
      ? new Date(current.created_at).toLocaleDateString("it-IT")
      : "-"}
  </div>
</div>

            <div className="customer-detail-summary customer-detail-summary--inline">
              <div className="customer-detail-summary-box">
                <div className="customer-detail-summary-label">Email</div>
                <div className="customer-detail-summary-value">{current.email || "-"}</div>
              </div>

              <div className="customer-detail-summary-box">
                <div className="customer-detail-summary-label">Telefono</div>
                <div className="customer-detail-summary-value">{current.phone || "-"}</div>
              </div>

              <div className="customer-detail-summary-box">
                <div className="customer-detail-summary-label">Indirizzo</div>
                <div className="customer-detail-summary-value">{fullAddress || "-"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="customer-detail-grid">

        <div className="customer-detail-card customer-detail-card--full">
  <section className="customer-detail-section-block">
    <div className="customer-detail-section-title">Dati principali</div>

    <div className="customer-detail-form-grid-2">
      <Field label="Tipo cliente">
        {editMode ? (
          <select
            className="apple-select"
            value={draft.customer_type || "private"}
            onChange={(e) =>
              updateField("customer_type", e.target.value as CustomerType)
            }
          >
            <option value="private">Privato</option>
            <option value="company">Azienda</option>
          </select>
        ) : (
          <ValueBox>{getTypeLabel(customer.customer_type)}</ValueBox>
        )}
      </Field>

      <Field
        label={
          current.customer_type === "company"
            ? "Denominazione"
            : "Nome cliente"
        }
      >
        {editMode ? (
          <input
            className="apple-input"
            value={draft.name || ""}
            onChange={(e) => updateField("name", e.target.value)}
          />
        ) : (
          <ValueBox>{customer.name || "-"}</ValueBox>
        )}
      </Field>
    </div>

    <div className="customer-detail-form-grid-2">
      <Field label="Referente">
        {editMode ? (
          <input
            className="apple-input"
            value={draft.contact_name || ""}
            onChange={(e) => updateField("contact_name", e.target.value)}
          />
        ) : (
          <ValueBox>{customer.contact_name || "-"}</ValueBox>
        )}
      </Field>

      <Field label="Telefono">
        {editMode ? (
          <input
            className="apple-input"
            value={draft.phone || ""}
            onChange={(e) => updateField("phone", e.target.value)}
          />
        ) : (
          <ValueBox>{customer.phone || "-"}</ValueBox>
        )}
      </Field>
    </div>

    <div className="customer-detail-form-grid-2">
      <Field label="Email">
        {editMode ? (
          <input
            className="apple-input"
            value={draft.email || ""}
            onChange={(e) => updateField("email", e.target.value)}
          />
        ) : (
          <ValueBox>{customer.email || "-"}</ValueBox>
        )}
      </Field>

      <Field label="PEC">
        {editMode ? (
          <input
            className="apple-input"
            value={draft.pec || ""}
            onChange={(e) => updateField("pec", e.target.value)}
          />
        ) : (
          <ValueBox>{customer.pec || "-"}</ValueBox>
        )}
      </Field>
    </div>

    <Field label="Note">
      {editMode ? (
        <textarea
          className="apple-textarea"
          value={draft.notes || ""}
          onChange={(e) => updateField("notes", e.target.value)}
        />
      ) : (
        <ValueBox multiline>{customer.notes || "-"}</ValueBox>
      )}
    </Field>
  </section>

  <section className="customer-detail-section-block customer-detail-section-block--divider">
    <div className="customer-detail-section-title">Indirizzo</div>

    <Field label="Indirizzo">
      {editMode ? (
        <input
          className="apple-input"
          value={draft.address || ""}
          onChange={(e) => updateField("address", e.target.value)}
        />
      ) : (
        <ValueBox>{customer.address || "-"}</ValueBox>
      )}
    </Field>

    <div className="customer-detail-form-grid-3">
      <Field label="CAP">
        {editMode ? (
          <input
            className="apple-input"
            value={draft.zip || ""}
            onChange={(e) => updateField("zip", e.target.value)}
          />
        ) : (
          <ValueBox>{customer.zip || "-"}</ValueBox>
        )}
      </Field>

      <Field label="Comune">
        {editMode ? (
          <input
            className="apple-input"
            value={draft.city || ""}
            onChange={(e) => updateField("city", e.target.value)}
          />
        ) : (
          <ValueBox>{customer.city || "-"}</ValueBox>
        )}
      </Field>

      <Field label="Provincia">
        {editMode ? (
          <input
            className="apple-input"
            value={draft.province || ""}
            onChange={(e) => updateField("province", e.target.value)}
          />
        ) : (
          <ValueBox>{customer.province || "-"}</ValueBox>
        )}
      </Field>
    </div>

    <div className="customer-detail-form-grid-2">
      <Field label="Paese">
        {editMode ? (
          <input
            className="apple-input"
            value={draft.country || ""}
            onChange={(e) => updateField("country", e.target.value)}
          />
        ) : (
          <ValueBox>{customer.country || "-"}</ValueBox>
        )}
      </Field>

      <Field label="Note indirizzo">
        {editMode ? (
          <input
            className="apple-input"
            value={draft.address_notes || ""}
            onChange={(e) => updateField("address_notes", e.target.value)}
          />
        ) : (
          <ValueBox>{customer.address_notes || "-"}</ValueBox>
        )}
      </Field>
    </div>
  </section>

  <section className="customer-detail-section-block customer-detail-section-block--divider">
    <div className="customer-detail-section-title">Dati fiscali</div>

    <div className="customer-detail-form-grid-2">
      <Field label="Partita IVA">
        {editMode ? (
          <input
            className="apple-input"
            value={draft.vat_number || ""}
            onChange={(e) => updateField("vat_number", e.target.value)}
          />
        ) : (
          <ValueBox>{customer.vat_number || "-"}</ValueBox>
        )}
      </Field>

      <Field label="Codice fiscale">
        {editMode ? (
          <input
            className="apple-input"
            value={draft.tax_code || ""}
            onChange={(e) => updateField("tax_code", e.target.value)}
          />
        ) : (
          <ValueBox>{customer.tax_code || "-"}</ValueBox>
        )}
      </Field>
    </div>

    <div className="customer-detail-form-grid-2">
      <Field label="Codice SDI">
        {editMode ? (
          <input
            className="apple-input"
            value={draft.sdi_code || ""}
            onChange={(e) => updateField("sdi_code", e.target.value)}
          />
        ) : (
          <ValueBox>{customer.sdi_code || "-"}</ValueBox>
        )}
      </Field>

      <Field label="IBAN">
        {editMode ? (
          <input
            className="apple-input"
            value={draft.iban || ""}
            onChange={(e) => updateField("iban", e.target.value)}
          />
        ) : (
          <ValueBox>{customer.iban || "-"}</ValueBox>
        )}
      </Field>
    </div>
  </section>
</div>

        <div className="customer-detail-card customer-detail-card--full">
          <div className="customer-detail-section-header">
            <div className="customer-detail-section-title customer-detail-section-title--no-margin">
              Bici associate
            </div>
            <button
              className="btn-secondary"
              onClick={() => router.push(`/bikes?customerId=${customerId}`)}
            >
              + Aggiungi bici
            </button>
          </div>

          {bikes.length === 0 ? (
            <div className="customer-detail-empty">Nessuna bici associata a questo cliente.</div>
          ) : (
            <div className="customer-detail-list">
              {bikes.map((bike) => (
                <button
                  key={bike.id}
                  className="customer-detail-list-row"
                  onClick={() => router.push(`/bikes/${bike.id}`)}
                >
                  <div className="customer-detail-list-main">
                    <div className="customer-detail-row-title">
                      {bike.brand || "-"} {bike.model || ""}
                    </div>

                    <div className="customer-detail-row-sub">
                      Tipo: {getBikeTypeLabel(bike)} · Telaio: {getBikeSerialLabel(bike)}
                    </div>

                    <div className="customer-detail-row-meta">
                      Colore: {bike.color || "-"} · Acquisto: {formatCurrency(bike.purchase_price)}
                    </div>
                  </div>

                  <div className="customer-detail-open-tag">Apri bici</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="customer-detail-card customer-detail-card--full">
          <div className="customer-detail-section-header">
            <div className="customer-detail-section-title customer-detail-section-title--no-margin">
              Schede lavoro del cliente
            </div>
            <button
              className="btn-secondary"
              onClick={() => router.push(`/workorders/new?customerId=${customerId}`)}
            >
              + Nuova scheda lavoro
            </button>
          </div>

          {workOrders.length === 0 ? (
            <div className="customer-detail-empty">
              Nessuna scheda lavoro collegata a questo cliente.
            </div>
          ) : (
            <div className="customer-detail-list">
              {workOrders.map((wo) => (
                <button
                  key={wo.id}
                  className="customer-detail-list-row"
                  onClick={() => {
                    if (wo.status === "closed") {
                      router.push(`/workorders/${wo.id}/report`);
                    } else {
                      router.push(`/workorders/${wo.id}`);
                    }
                  }}
                >
                  <div className="customer-detail-list-main">
                    <div className="customer-detail-row-title">{getWorkOrderBikeLabel(wo.bikes)}</div>
                    <div className="customer-detail-row-sub">{wo.notes || "Scheda lavoro cliente"}</div>
                    <div className="customer-detail-row-meta">
                      Data:{" "}
                      {wo.created_at
                        ? new Date(wo.created_at).toLocaleDateString("it-IT")
                        : "-"}
                    </div>
                  </div>

                  <div className="customer-detail-list-right">
                    <span className={getStatusBadgeClass(wo.status)}>
                      {formatStatus(wo.status)}
                    </span>
                    <div className="customer-detail-open-tag">Apri scheda</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>

      <div className="customer-detail-footer">
        <button
          className="customer-detail-danger-btn"
          onClick={deleteCustomer}
          disabled={saving || deleting}
        >
          {deleting ? "Eliminazione..." : "Elimina cliente"}
        </button>

        <div className="customer-detail-footer-actions">
          {!editMode ? (
            <button className="btn-primary" onClick={() => setEditMode(true)}>
              Modifica cliente
            </button>
          ) : (
            <>
              <button className="btn-secondary" onClick={cancelEdit} disabled={saving}>
                Annulla
              </button>
              <button className="btn-primary" onClick={saveCustomer} disabled={saving}>
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
    <div className="customer-detail-field">
      <label className="customer-detail-label">{label}</label>
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
      className={
        multiline
          ? "customer-detail-value-box customer-detail-value-box--multiline"
          : "customer-detail-value-box"
      }
    >
      {children}
    </div>
  );
}
