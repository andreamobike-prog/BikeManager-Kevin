"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";

type Supplier = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  vat_number: string | null;
  tax_code?: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  province: string | null;
  country: string | null;
  contact_name?: string | null;
  pec?: string | null;
  iban?: string | null;
  sdi_code?: string | null;
  notes: string | null;
  supplier_type?: "private" | "company" | null;
};

type ToastType = "success" | "error" | "info";

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [draft, setDraft] = useState<Supplier | null>(null);
  const [edit, setEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState<{
    type: ToastType;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (id) {
      loadSupplier();
    }
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadSupplier() {
    setLoading(true);

    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Errore caricamento fornitore:", error);
      setToast({
        type: "error",
        message: `Errore caricamento fornitore: ${error.message}`,
      });
      setLoading(false);
      return;
    }

    setSupplier(data as Supplier);
    setDraft(data as Supplier);
    setLoading(false);
  }

  function update<K extends keyof Supplier>(key: K, value: Supplier[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!draft) return;

    if (!String(draft.name || "").trim()) {
      setToast({
        type: "error",
        message: "Il nome fornitore è obbligatorio.",
      });
      return;
    }

    setSaving(true);

    const payload = {
      ...draft,
      name: draft.name?.trim() || null,
      email: draft.email?.trim().toLowerCase() || null,
      phone: draft.phone?.trim() || null,
      vat_number: draft.vat_number?.trim().toUpperCase() || null,
      tax_code: draft.tax_code?.trim().toUpperCase() || null,
      address: draft.address?.trim() || null,
      city: draft.city?.trim() || null,
      zip: draft.zip?.trim() || null,
      province: draft.province?.trim().toUpperCase() || null,
      country: draft.country?.trim() || null,
      contact_name: draft.contact_name?.trim() || null,
      pec: draft.pec?.trim().toLowerCase() || null,
      iban: draft.iban?.trim().toUpperCase() || null,
      sdi_code: draft.sdi_code?.trim().toUpperCase() || null,
      notes: draft.notes?.trim() || null,
    };

    const { error } = await supabase.from("suppliers").update(payload).eq("id", id);

    if (error) {
      console.error("Errore salvataggio fornitore:", error);
      setToast({
        type: "error",
        message: `Errore salvataggio fornitore: ${error.message}`,
      });
      setSaving(false);
      return;
    }

    setSupplier(payload as Supplier);
    setDraft(payload as Supplier);
    setEdit(false);
    setSaving(false);

    setToast({
      type: "success",
      message: "Fornitore salvato correttamente.",
    });
  }

  function cancelEdit() {
    setDraft(supplier);
    setEdit(false);
  }

  function getTypeLabel(type: Supplier["supplier_type"]) {
    return type === "company" ? "Azienda" : "Privato";
  }

  function getFullAddress(s: Supplier | null) {
    if (!s) return "-";

    const first = [s.address || ""].filter(Boolean).join("");
    const second = [s.zip || "", s.city || "", s.province ? `(${s.province})` : "", s.country || ""]
      .filter(Boolean)
      .join(" ");

    return [first, second].filter(Boolean).join(", ") || "-";
  }

  if (loading) {
    return <div className="app-page-shell">Caricamento fornitore...</div>;
  }

  if (!supplier || !draft) {
    return <div className="app-page-shell">Fornitore non trovato.</div>;
  }

  const current = edit ? draft : supplier;

  return (
    <div className="app-page-shell supplier-detail-page-shell">
      {toast && (
        <div
          className={`toast ${
            toast.type === "success"
              ? "toastSuccess"
              : toast.type === "error"
                ? "toastError"
                : "toastInfo"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="page-stack">
        <div className="page-header supplier-detail-header">
          <div className="page-header__left">
            <div className="apple-kicker">Anagrafica fornitori / Scheda</div>
            <h1 className="apple-page-title">Scheda fornitore</h1>
            <p className="apple-page-subtitle supplier-detail-subtitle">
              Gestisci dati anagrafici, fiscali e operativi del fornitore. Questa scheda
              sarà il punto di collegamento futuro con articoli, EAN, giacenze e storico movimenti.
            </p>
          </div>

          <div className="page-header__right supplier-detail-header-actions">
            <button
              className="btn-secondary"
              onClick={() => router.push("/suppliers")}
              disabled={saving}
            >
              ← Torna ai fornitori
            </button>

            {!edit ? (
              <button className="btn-primary" onClick={() => setEdit(true)}>
                Modifica
              </button>
            ) : (
              <>
                <button className="btn-secondary" onClick={cancelEdit} disabled={saving}>
                  Annulla
                </button>
                <button className="btn-primary" onClick={save} disabled={saving}>
                  {saving ? "Salvataggio..." : "Salva"}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="supplier-detail-hero">
          <div className="supplier-detail-hero__left">
            <div className="supplier-detail-avatar">
              {(current.name || "?").charAt(0).toUpperCase()}
            </div>

            <div className="supplier-detail-hero__content">
              <div className="supplier-detail-name-row">
                <div className="supplier-detail-name">{current.name || "-"}</div>
                <span
                  className={
                    current.supplier_type === "company"
                      ? "badge badge-purple"
                      : "badge badge-blue"
                  }
                >
                  {getTypeLabel(current.supplier_type)}
                </span>
              </div>

              <div className="supplier-detail-meta">ID: {current.id}</div>

              <div className="supplier-detail-summary supplier-detail-summary--inline">
                <div className="supplier-detail-summary-box">
                  <div className="supplier-detail-summary-label">Referente</div>
                  <div className="supplier-detail-summary-value">
                    {current.contact_name || "-"}
                  </div>
                </div>

                <div className="supplier-detail-summary-box">
                  <div className="supplier-detail-summary-label">Email</div>
                  <div className="supplier-detail-summary-value">
                    {current.email || "-"}
                  </div>
                </div>

                <div className="supplier-detail-summary-box">
                  <div className="supplier-detail-summary-label">Telefono</div>
                  <div className="supplier-detail-summary-value">
                    {current.phone || "-"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="section-grid-2">
          <div className="supplier-detail-card">
            <div className="supplier-detail-section-title">Dati principali</div>

            <div className="supplier-detail-form-grid-2">
              <Field label="Nome fornitore">
                <Input
                  value={current.name}
                  edit={edit}
                  onChange={(v) => update("name", v)}
                />
              </Field>

              <Field label="Tipo fornitore">
                {edit ? (
                  <select
                    className="apple-select"
                    value={current.supplier_type || "company"}
                    onChange={(e) =>
                      update("supplier_type", e.target.value as "private" | "company")
                    }
                  >
                    <option value="company">Azienda</option>
                    <option value="private">Privato</option>
                  </select>
                ) : (
                  <div className="supplier-detail-value-box">
                    {getTypeLabel(current.supplier_type)}
                  </div>
                )}
              </Field>
            </div>

            <div className="supplier-detail-form-grid-2">
              <Field label="Referente">
                <Input
                  value={current.contact_name}
                  edit={edit}
                  onChange={(v) => update("contact_name", v)}
                />
              </Field>

              <Field label="Telefono">
                <Input
                  value={current.phone}
                  edit={edit}
                  onChange={(v) => update("phone", v)}
                />
              </Field>
            </div>

            <div className="supplier-detail-form-grid-2">
              <Field label="Email">
                <Input
                  value={current.email}
                  edit={edit}
                  onChange={(v) => update("email", v)}
                />
              </Field>

              <Field label="PEC">
                <Input
                  value={current.pec}
                  edit={edit}
                  onChange={(v) => update("pec", v)}
                />
              </Field>
            </div>

            <Field label="Note">
              <Input
                value={current.notes}
                edit={edit}
                onChange={(v) => update("notes", v)}
                multiline
              />
            </Field>
          </div>

          <div className="supplier-detail-card">
            <div className="supplier-detail-section-title">Dati fiscali e amministrativi</div>

            <div className="supplier-detail-form-grid-2">
              <Field label="Partita IVA">
                <Input
                  value={current.vat_number}
                  edit={edit}
                  onChange={(v) => update("vat_number", v)}
                />
              </Field>

              <Field label="Codice fiscale">
                <Input
                  value={current.tax_code}
                  edit={edit}
                  onChange={(v) => update("tax_code", v)}
                />
              </Field>
            </div>

            <div className="supplier-detail-form-grid-2">
              <Field label="Codice SDI">
                <Input
                  value={current.sdi_code}
                  edit={edit}
                  onChange={(v) => update("sdi_code", v)}
                />
              </Field>

              <Field label="IBAN">
                <Input
                  value={current.iban}
                  edit={edit}
                  onChange={(v) => update("iban", v)}
                />
              </Field>
            </div>

            <Field label="Indirizzo completo">
              <div className="supplier-detail-value-box supplier-detail-value-box--multiline">
                {getFullAddress(current)}
              </div>
            </Field>
          </div>
        </div>

        <div className="supplier-detail-card supplier-detail-card--full">
          <div className="supplier-detail-section-header">
            <div>
              <div className="supplier-detail-section-title supplier-detail-section-title--no-margin">
                Indirizzo
              </div>
            </div>
          </div>

          <div className="supplier-detail-form-grid-2">
            <Field label="Indirizzo">
              <Input
                value={current.address}
                edit={edit}
                onChange={(v) => update("address", v)}
              />
            </Field>

            <Field label="Paese">
              <Input
                value={current.country}
                edit={edit}
                onChange={(v) => update("country", v)}
              />
            </Field>
          </div>

          <div className="supplier-detail-form-grid-3">
            <Field label="Città">
              <Input
                value={current.city}
                edit={edit}
                onChange={(v) => update("city", v)}
              />
            </Field>

            <Field label="CAP">
              <Input
                value={current.zip}
                edit={edit}
                onChange={(v) => update("zip", v)}
              />
            </Field>

            <Field label="Provincia">
              <Input
                value={current.province}
                edit={edit}
                onChange={(v) => update("province", v)}
              />
            </Field>
          </div>
        </div>

        <div className="supplier-detail-card supplier-detail-card--full">
          <div className="supplier-detail-section-header">
            <div>
              <div className="supplier-detail-section-title supplier-detail-section-title--no-margin">
                Collegamenti magazzino
              </div>
              <div className="apple-page-subtitle customers-section-subtitle">
                Questa sezione sarà il punto di raccordo con articoli, EAN, giacenze,
                ultimo costo e movimenti collegati al fornitore.
              </div>
            </div>
          </div>

          <div className="supplier-detail-empty">
            Nessun collegamento magazzino ancora configurato in questa scheda.
          </div>
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
    <div className="supplier-detail-field">
      <div className="supplier-detail-label">{label}</div>
      {children}
    </div>
  );
}

function Input({
  value,
  edit,
  onChange,
  multiline,
}: {
  value: string | null | undefined;
  edit: boolean;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  if (!edit) {
    return (
      <div
        className={`supplier-detail-value-box${
          multiline ? " supplier-detail-value-box--multiline" : ""
        }`}
      >
        {value || "-"}
      </div>
    );
  }

  if (multiline) {
    return (
      <textarea
        className="apple-textarea"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <input
      className="apple-input"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}