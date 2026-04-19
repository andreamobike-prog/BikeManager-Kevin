"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";

type Product = {
  id: string;
  title: string | null;
  ean: string | null;
  description: string | null;
  location: string | null;
  warehouse_qty: number | null;
  price_b2b: number | null;
  price_b2c: number | null;
  supplier_id?: string | null;
  supplier_product_code?: string | null;
};

type Supplier = {
  id: string;
  name: string | null;
};

type ToastType = "success" | "error" | "info";

export default function InventoryProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  const [product, setProduct] = useState<Product | null>(null);
  const [draft, setDraft] = useState<Product | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState(false);

  const [toast, setToast] = useState<{
    type: ToastType;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadData() {
    setLoading(true);

    const [
      { data: productData, error: productError },
      { data: suppliersData, error: suppliersError },
    ] = await Promise.all([
      supabase.from("products").select("*").eq("id", id).single(),
      supabase.from("suppliers").select("id,name").order("name", { ascending: true }),
    ]);

    if (productError) {
      console.error("Errore caricamento articolo:", productError);
      setToast({
        type: "error",
        message: `Errore caricamento articolo: ${productError.message}`,
      });
      setLoading(false);
      return;
    }

    if (suppliersError) {
      console.error("Errore caricamento fornitori:", suppliersError);
      setToast({
        type: "error",
        message: `Errore caricamento fornitori: ${suppliersError.message}`,
      });
    }

    const loadedProduct = (productData as Product) || null;
    setProduct(loadedProduct);
    setDraft(loadedProduct);
    setSuppliers((suppliersData as Supplier[]) || []);
    setLoading(false);
  }

  function update<K extends keyof Product>(key: K, value: Product[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function parseNumber(value: string) {
    const normalized = value.replace(",", ".").trim();
    if (!normalized) return 0;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async function save() {
    if (!draft) return;

    if (!String(draft.title || "").trim()) {
      setToast({
        type: "error",
        message: "Il nome articolo è obbligatorio.",
      });
      return;
    }

    if (!String(draft.location || "").trim()) {
      setToast({
        type: "error",
        message: "La posizione scaffale è obbligatoria.",
      });
      return;
    }

    setSaving(true);

    const payload = {
      title: String(draft.title || "").trim(),
      ean: String(draft.ean || "").trim() || null,
      description: String(draft.description || "").trim() || null,
      location: String(draft.location || "").trim(),
      warehouse_qty: Number(draft.warehouse_qty || 0),
      price_b2b: Number(draft.price_b2b || 0),
      price_b2c: Number(draft.price_b2c || 0),
      supplier_id: draft.supplier_id || null,
      supplier_product_code: String(draft.supplier_product_code || "").trim() || null,
    };

    const { error } = await supabase.from("products").update(payload).eq("id", id);

    if (error) {
      console.error("Errore salvataggio articolo:", error);
      setToast({
        type: "error",
        message: `Errore salvataggio articolo: ${error.message}`,
      });
      setSaving(false);
      return;
    }

    setProduct((prev) => (prev ? { ...prev, ...payload } : prev));
    setDraft((prev) => (prev ? { ...prev, ...payload } : prev));
    setEdit(false);
    setSaving(false);

    setToast({
      type: "success",
      message: "Articolo salvato correttamente.",
    });
  }

  function cancelEdit() {
    setDraft(product);
    setEdit(false);
  }

  const supplierName = useMemo(() => {
    if (!draft?.supplier_id) return "-";
    return suppliers.find((s) => s.id === draft.supplier_id)?.name || "-";
  }, [draft?.supplier_id, suppliers]);

  const stockValue = useMemo(() => {
    const qty = Number(draft?.warehouse_qty || 0);
    const b2b = Number(draft?.price_b2b || 0);
    return qty * b2b;
  }, [draft?.warehouse_qty, draft?.price_b2b]);

  const marginValue = useMemo(() => {
    const b2b = Number(draft?.price_b2b || 0);
    const b2c = Number(draft?.price_b2c || 0);
    return b2c - b2b;
  }, [draft?.price_b2b, draft?.price_b2c]);

  function formatCurrency(value: number | null | undefined) {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(Number(value || 0));
  }

  if (loading) {
    return <div className="app-page-shell">Caricamento articolo...</div>;
  }

  if (!product || !draft) {
    return <div className="app-page-shell">Articolo non trovato.</div>;
  }

  return (
    <div className="app-page-shell inventory-detail-page-shell">
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
        <div className="page-header inventory-detail-header">
          <div className="page-header__left">
            <div className="apple-kicker">Magazzino / Scheda articolo</div>
            <h1 className="apple-page-title">Scheda articolo</h1>
            <p className="apple-page-subtitle inventory-detail-subtitle">
              Gestisci dati articolo, EAN, prezzi, giacenza e collegamento fornitore in una scheda unica.
            </p>
          </div>

          <div className="page-header__right inventory-detail-header-actions">
            <button
              className="btn-secondary"
              onClick={() => router.push("/inventory")}
              disabled={saving}
            >
              ← Torna al magazzino
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

        <div className="inventory-detail-hero">
          <div className="inventory-detail-hero__left">
            <div className="inventory-detail-avatar">
              {(draft.title || "?").charAt(0).toUpperCase()}
            </div>

            <div className="inventory-detail-hero__content">
              <div className="inventory-detail-name-row">
                <div className="inventory-detail-name">{draft.title || "-"}</div>
              </div>

              <div className="inventory-detail-meta">
                EAN: {draft.ean || "-"}
              </div>

              <div className="inventory-detail-summary inventory-detail-summary--inline">
                <div className="inventory-detail-summary-box">
                  <div className="inventory-detail-summary-label">Giacenza</div>
                  <div className="inventory-detail-summary-value">
                    {Number(draft.warehouse_qty || 0)}
                  </div>
                </div>

                <div className="inventory-detail-summary-box">
                  <div className="inventory-detail-summary-label">Prezzo B2B</div>
                  <div className="inventory-detail-summary-value">
                    {formatCurrency(draft.price_b2b)}
                  </div>
                </div>

                <div className="inventory-detail-summary-box">
                  <div className="inventory-detail-summary-label">Prezzo B2C</div>
                  <div className="inventory-detail-summary-value">
                    {formatCurrency(draft.price_b2c)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="section-grid-2">
          <div className="inventory-detail-card">
            <div className="inventory-detail-section-title">Dati articolo</div>

            <div className="inventory-detail-form-grid-2">
              <Field label="Nome articolo">
                <Input
                  value={draft.title}
                  edit={edit}
                  onChange={(v) => update("title", v)}
                />
              </Field>

              <Field label="EAN">
                <Input
                  value={draft.ean}
                  edit={edit}
                  onChange={(v) => update("ean", v)}
                />
              </Field>
            </div>

            <Field label="Descrizione">
              <Input
                value={draft.description}
                edit={edit}
                onChange={(v) => update("description", v)}
                multiline
              />
            </Field>

            <Field label="Posizione scaffale">
              <Input
                value={draft.location}
                edit={edit}
                onChange={(v) => update("location", v)}
              />
            </Field>
          </div>

          <div className="inventory-detail-card">
            <div className="inventory-detail-section-title">Prezzi e magazzino</div>

            <div className="inventory-detail-form-grid-2">
              <Field label="Giacenza attuale">
                {edit ? (
                  <input
                    className="apple-input"
                    type="number"
                    min={0}
                    value={Number(draft.warehouse_qty || 0)}
                    onChange={(e) => update("warehouse_qty", Number(e.target.value))}
                  />
                ) : (
                  <div className="inventory-detail-value-box">
                    {Number(draft.warehouse_qty || 0)}
                  </div>
                )}
              </Field>

              <Field label="Valore stock">
                <div className="inventory-detail-value-box">
                  {formatCurrency(stockValue)}
                </div>
              </Field>
            </div>

            <div className="inventory-detail-form-grid-2">
              <Field label="Prezzo B2B">
                {edit ? (
                  <input
                    className="apple-input"
                    value={String(draft.price_b2b ?? "")}
                    onChange={(e) => update("price_b2b", parseNumber(e.target.value))}
                  />
                ) : (
                  <div className="inventory-detail-value-box">
                    {formatCurrency(draft.price_b2b)}
                  </div>
                )}
              </Field>

              <Field label="Prezzo B2C">
                {edit ? (
                  <input
                    className="apple-input"
                    value={String(draft.price_b2c ?? "")}
                    onChange={(e) => update("price_b2c", parseNumber(e.target.value))}
                  />
                ) : (
                  <div className="inventory-detail-value-box">
                    {formatCurrency(draft.price_b2c)}
                  </div>
                )}
              </Field>
            </div>

            <Field label="Margine unitario">
              <div className="inventory-detail-value-box">
                {formatCurrency(marginValue)}
              </div>
            </Field>
          </div>
        </div>

        <div className="inventory-detail-card inventory-detail-card--full">
          <div className="inventory-detail-section-header">
            <div>
              <div className="inventory-detail-section-title inventory-detail-section-title--no-margin">
                Fornitore
              </div>
            </div>
          </div>

          <div className="inventory-detail-form-grid-2">
            <Field label="Fornitore principale">
              {edit ? (
                <select
                  className="apple-select"
                  value={draft.supplier_id || ""}
                  onChange={(e) => update("supplier_id", e.target.value || null)}
                >
                  <option value="">Nessun fornitore collegato</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name || "-"}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="inventory-detail-value-box">{supplierName}</div>
              )}
            </Field>

            <Field label="Codice articolo fornitore">
              <Input
                value={draft.supplier_product_code}
                edit={edit}
                onChange={(v) => update("supplier_product_code", v)}
              />
            </Field>
          </div>
        </div>

        <div className="inventory-detail-card inventory-detail-card--full">
          <div className="inventory-detail-section-header">
            <div>
              <div className="inventory-detail-section-title inventory-detail-section-title--no-margin">
                Collegamenti operativi
              </div>
              <div className="apple-page-subtitle customers-section-subtitle">
                Questa sezione ospiterà storico movimenti, carichi, utilizzo in officina e riferimenti futuri.
              </div>
            </div>
          </div>

          <div className="inventory-detail-empty">
            Nessun collegamento operativo ancora configurato in questa scheda.
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
    <div className="inventory-detail-field">
      <div className="inventory-detail-label">{label}</div>
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
        className={`inventory-detail-value-box${
          multiline ? " inventory-detail-value-box--multiline" : ""
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
