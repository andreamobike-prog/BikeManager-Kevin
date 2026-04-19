"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import ScanProductButton from "@/components/ScanProductButton";
import { Package2 } from "lucide-react";

type ProductForm = {
  title: string;
  ean: string;
  description: string;
  supplier: string;
  location: string;
  warehouse_qty: string;
  price_b2b: string;
  price_b2c: string;
};

type ToastType = "success" | "error" | "info";

type SupplierRow = {
  name: string | null;
};

export default function NewInventoryPage() {
  const router = useRouter();

  const [form, setForm] = useState<ProductForm>({
    title: "",
    ean: "",
    description: "",
    supplier: "",
    location: "",
    warehouse_qty: "",
    price_b2b: "",
    price_b2c: "",
  });

  const [locations, setLocations] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [toast, setToast] = useState<{
    type: ToastType;
    message: string;
  } | null>(null);

  useEffect(() => {
    loadLocations();
    loadSuppliers();
  }, []);
  async function loadSuppliers() {
    setLoadingSuppliers(true);

    const { data, error } = await supabase
      .from("suppliers")
      .select("name")
      .order("name");

    if (error) {
      console.error("Errore caricamento fornitori:", error);
      setLoadingSuppliers(false);
      return;
    }

    const uniqueSuppliers = Array.from(
      new Set(
        ((data as SupplierRow[]) || [])
          .map((item) => (item.name || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    setSuppliers(uniqueSuppliers);
    setLoadingSuppliers(false);
  }

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadLocations() {
    setLoadingLocations(true);

    const { data, error } = await supabase
      .from("products")
      .select("location")
      .not("location", "is", null);

    if (error) {
      console.error("Errore caricamento posizioni:", error);
      setLoadingLocations(false);
      return;
    }

    const uniqueLocations = Array.from(
      new Set(
        ((data as { location: string | null }[]) || [])
          .map((item) => (item.location || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    setLocations(uniqueLocations);
    setLoadingLocations(false);
  }

  function updateField<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function formatCurrency(value: string | number | null | undefined) {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(Number(value || 0));
  }

  const stockValuePreview = useMemo(() => {
    const qty = Number(form.warehouse_qty || 0);
    const price = Number(form.price_b2b || 0);
    return qty * price;
  }, [form.warehouse_qty, form.price_b2b]);

  const marginPreview = useMemo(() => {
    const b2b = Number(form.price_b2b || 0);
    const b2c = Number(form.price_b2c || 0);
    return b2c - b2b;
  }, [form.price_b2b, form.price_b2c]);

  const locationExists = useMemo(() => {
    const current = form.location.trim().toLowerCase();
    if (!current) return false;
    return locations.some((loc) => loc.toLowerCase() === current);
  }, [form.location, locations]);

  function validateForm() {
    if (!form.title.trim()) {
      setToast({ type: "error", message: "Il nome articolo è obbligatorio." });
      return false;
    }

    if (!form.location.trim()) {
      setToast({ type: "error", message: "La posizione scaffale è obbligatoria." });
      return false;
    }

    const qty = Number(form.warehouse_qty || 0);
    if (Number.isNaN(qty) || qty < 0) {
      setToast({
        type: "error",
        message: "La quantità iniziale deve essere zero o maggiore.",
      });
      return false;
    }

    const priceB2B = Number(form.price_b2b || 0);
    const priceB2C = Number(form.price_b2c || 0);

    if (Number.isNaN(priceB2B) || priceB2B < 0) {
      setToast({
        type: "error",
        message: "Il prezzo B2B deve essere zero o maggiore.",
      });
      return false;
    }

    if (Number.isNaN(priceB2C) || priceB2C < 0) {
      setToast({
        type: "error",
        message: "Il prezzo B2C deve essere zero o maggiore.",
      });
      return false;
    }

    return true;
  }

  function openConfirm() {
    if (!validateForm()) return;
    setShowConfirm(true);
  }

  async function saveProduct() {
    if (!validateForm()) return;

    setSaving(true);

    const payload = {
      title: form.title.trim(),
      ean: form.ean.trim() || null,
      description: form.description.trim() || null,
      supplier: form.supplier.trim() || null,
      location: form.location.trim(),
      warehouse_qty: Number(form.warehouse_qty || 0),
      price_b2b: Number(form.price_b2b || 0),
      price_b2c: Number(form.price_b2c || 0),
    };

    const { error } = await supabase.from("products").insert(payload);

    if (error) {
      console.error("Errore salvataggio prodotto:", error);
      setToast({
        type: "error",
        message: `Errore salvataggio: ${error.message}`,
      });
      setSaving(false);
      return;
    }

    setShowConfirm(false);
    setToast({
      type: "success",
      message: "Articolo salvato correttamente.",
    });

    router.push("/inventory");
  }

  return (
    <div className="inventory-new-page">
      {toast && (
        <div
          className={`inventory-new-toast ${toast.type === "success"
            ? "inventory-new-toast--success"
            : toast.type === "error"
              ? "inventory-new-toast--error"
              : "inventory-new-toast--info"
            }`}
        >
          {toast.message}
        </div>
      )}

      {showConfirm && (
        <div className="inventory-new-overlay">
          <div className="inventory-new-confirm-modal">
            <div className="inventory-new-confirm-header">
              <div className="inventory-new-confirm-icon">
                <Package2 size={24} strokeWidth={2} />
              </div>

              <div className="inventory-new-confirm-main">
                <h2 className="inventory-new-confirm-title">Conferma salvataggio articolo</h2>
                <p className="inventory-new-confirm-text">
                  Verifica i dati prima di registrare definitivamente il nuovo articolo in magazzino.
                </p>
              </div>
            </div>

            <div className="inventory-new-confirm-section">
              <div className="inventory-new-confirm-section-title">Riepilogo inserimento</div>

              <div className="inventory-new-confirm-grid">
                <ConfirmItem label="Nome articolo" value={form.title || "-"} />
                <ConfirmItem label="EAN" value={form.ean || "-"} />
                <ConfirmItem label="Fornitore" value={form.supplier || "-"} />
                <ConfirmItem label="Posizione scaffale" value={form.location || "-"} />
                <ConfirmItem
                  label="Quantità iniziale"
                  value={String(Number(form.warehouse_qty || 0))}
                />
                <ConfirmItem
                  label="Prezzo B2B"
                  value={formatCurrency(form.price_b2b)}
                />
                <ConfirmItem
                  label="Prezzo B2C"
                  value={formatCurrency(form.price_b2c)}
                />
                <ConfirmItem
                  label="Valore iniziale magazzino"
                  value={formatCurrency(stockValuePreview)}
                />
                <ConfirmItem
                  label="Margine unitario"
                  value={formatCurrency(marginPreview)}
                />
              </div>
            </div>

            <div className="inventory-new-confirm-note">
              {!locationExists && form.location.trim()
                ? "La posizione scaffale inserita non esiste ancora: verrà creata automaticamente con questo primo salvataggio."
                : "La posizione scaffale selezionata è già presente nel sistema e verrà semplicemente riutilizzata."}
            </div>

            <div className="inventory-new-confirm-actions">
              <button
                className="inventory-new-secondary-btn"
                onClick={() => setShowConfirm(false)}
                disabled={saving}
              >
                Annulla
              </button>

              <button
                className="inventory-new-primary-btn"
                onClick={saveProduct}
                disabled={saving}
              >
                {saving ? "Salvataggio..." : "Conferma salvataggio"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="inventory-new-header">
        <div>
          <div className="inventory-new-eyebrow">Magazzino</div>
          <h1 className="inventory-new-title">Nuovo articolo</h1>
          <p className="inventory-new-subtitle">
            Compila i dati dell’articolo con una struttura chiara, ordinata e pronta per l’uso gestionale.
          </p>
        </div>

        <button
          className="inventory-new-back-btn"
          onClick={() => router.push("/inventory")}
        >
          ← Torna al magazzino
        </button>
      </div>

      <div className="inventory-new-layout">
        <div className="inventory-new-main">
          <div className="inventory-new-card">
            <div className="inventory-new-section-header">
              <div className="inventory-new-section-title">Dati articolo</div>
              <div className="inventory-new-section-subtitle">
                Informazioni principali del prodotto o ricambio.
              </div>
            </div>

            <div className="inventory-new-grid-2">
              <InputField
                label="Nome articolo *"
                value={form.title}
                onChange={(v) => updateField("title", v)}
                placeholder="Es. Camera d'aria 700x25"
              />

              <div className="inventory-new-field">
                <label className="inventory-new-label">EAN / Codice</label>
                <div className="product-search-scan-row">
                  <input
                    className="inventory-new-input"
                    value={form.ean}
                    onChange={(e) => updateField("ean", e.target.value)}
                    placeholder="Codice EAN o interno"
                  />
                  <ScanProductButton
                    onScan={(value) => {
                      updateField("ean", value);
                      setToast({
                        type: "success",
                        message: "Codice acquisito correttamente.",
                      });
                    }}
                  />
                </div>
              </div>
            </div>

            <TextAreaField
              label="Descrizione"
              value={form.description}
              onChange={(v) => updateField("description", v)}
              placeholder="Descrizione tecnica, compatibilità, note prodotto..."
            />

            <div className="inventory-new-grid-2">
              <div className="inventory-new-field">
                <label className="inventory-new-label">Fornitore</label>
                <select
                  className="inventory-new-input"
                  value={form.supplier}
                  onChange={(e) => updateField("supplier", e.target.value)}
                  disabled={loadingSuppliers}
                >
                  <option value="">
                    {loadingSuppliers ? "Caricamento fornitori..." : "Nessun fornitore"}
                  </option>
                  {suppliers.map((supplier) => (
                    <option key={supplier} value={supplier}>
                      {supplier}
                    </option>
                  ))}
                </select>
                <div className="inventory-new-helper">
                  Seleziona un fornitore registrato oppure lascia vuoto.
                </div>
              </div>
            </div>
          </div>


          <div className="inventory-new-card">
            <div className="inventory-new-section-header">
              <div className="inventory-new-section-title">Magazzino</div>
              <div className="inventory-new-section-subtitle">
                Gestione posizione fisica e giacenza iniziale.
              </div>
            </div>

            <div className="inventory-new-grid-2">
              <div className="inventory-new-field">
                <label className="inventory-new-label">Posizione scaffale *</label>
                <input
                  list="warehouse-locations"
                  className="inventory-new-input"
                  placeholder={
                    loadingLocations
                      ? "Caricamento posizioni..."
                      : "Es. Armadio 1 / Scaffale A1 / Banco Officina"
                  }
                  value={form.location}
                  onChange={(e) => updateField("location", e.target.value)}
                />
                <datalist id="warehouse-locations">
                  {locations.map((location) => (
                    <option key={location} value={location} />
                  ))}
                </datalist>

                <div className="inventory-new-helper">
                  {form.location.trim()
                    ? locationExists
                      ? "Posizione esistente selezionata."
                      : "Nuova posizione: verrà creata automaticamente al primo inserimento."
                    : "Puoi selezionare una posizione esistente oppure inserirne una nuova."}
                </div>
              </div>

              <InputField
                label="Giacenza iniziale"
                value={form.warehouse_qty}
                onChange={(v) => updateField("warehouse_qty", v)}
                type="number"
                placeholder="Es. 5"
                helperText="Numero di pezzi disponibili al momento dell’inserimento."
              />
            </div>
          </div>

          <div className="inventory-new-card">
            <div className="inventory-new-section-header">
              <div className="inventory-new-section-title">Prezzi</div>
              <div className="inventory-new-section-subtitle">
                Valori economici del prodotto e riferimento commerciale.
              </div>
            </div>

            <div className="inventory-new-grid-2">
              <CurrencyField
                label="Costo / Prezzo B2B"
                value={form.price_b2b}
                onChange={(v) => updateField("price_b2b", v)}
                helperText="Costo interno o prezzo di acquisto."
              />

              <CurrencyField
                label="Prezzo vendita B2C"
                value={form.price_b2c}
                onChange={(v) => updateField("price_b2c", v)}
                helperText="Prezzo di vendita al cliente finale."
              />
            </div>
          </div>
        </div>

        <div className="inventory-new-side">
          <div className="inventory-new-card">
            <div className="inventory-new-summary-header">
              <div className="inventory-new-summary-title">Riepilogo</div>
              <div className="inventory-new-summary-subtitle">Controllo rapido</div>
            </div>

            <div className="inventory-new-summary-metric-list">
              <SummaryMetric
                label="Giacenza iniziale"
                value={String(Number(form.warehouse_qty || 0))}
              />
              <SummaryMetric
                label="Prezzo B2B"
                value={formatCurrency(form.price_b2b)}
              />
              <SummaryMetric
                label="Prezzo B2C"
                value={formatCurrency(form.price_b2c)}
              />
              <SummaryMetric
                label="Valore iniziale magazzino"
                value={formatCurrency(stockValuePreview)}
              />
              <SummaryMetric
                label="Margine unitario"
                value={formatCurrency(marginPreview)}
              />
              <SummaryMetric
                label="Fornitore"
                value={form.supplier || "Non impostato"}
              />
            </div>

            <div className="inventory-new-summary-divider" />

            <div className="inventory-new-summary-block">
              <div className="inventory-new-summary-block-label">Posizione scaffale</div>
              <div className="inventory-new-summary-block-value">
                {form.location || "Non impostata"}
              </div>
            </div>

            <div className="inventory-new-summary-actions">
              <button
                className="inventory-new-secondary-btn"
                onClick={() => router.push("/inventory")}
                disabled={saving}
              >
                Annulla
              </button>

              <button
                className="inventory-new-primary-btn"
                onClick={openConfirm}
                disabled={saving}
              >
                Salva articolo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="inventory-new-confirm-item">
      <div className="inventory-new-confirm-item-label">{label}</div>
      <div className="inventory-new-confirm-item-value">{value}</div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="inventory-new-summary-metric">
      <div className="inventory-new-summary-metric-label">{label}</div>
      <div className="inventory-new-summary-metric-value">{value}</div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  helperText,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  helperText?: string;
}) {
  return (
    <div className="inventory-new-field">
      <label className="inventory-new-label">{label}</label>
      <input
        type={type}
        className="inventory-new-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "0.01" : undefined}
      />
      {helperText ? <div className="inventory-new-helper">{helperText}</div> : null}
    </div>
  );
}

function CurrencyField({
  label,
  value,
  onChange,
  helperText,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
}) {
  return (
    <div className="inventory-new-field">
      <label className="inventory-new-label">{label}</label>
      <div className="inventory-new-currency-wrap">
        <span className="inventory-new-currency-symbol">€</span>
        <input
          type="text"
          inputMode="decimal"
          className="inventory-new-input inventory-new-currency-input"
          value={value.replace(".", ",")}
          onChange={(e) => onChange(e.target.value.replace(",", "."))}
          placeholder="0,00"
        />
      </div>
      {helperText ? <div className="inventory-new-helper">{helperText}</div> : null}
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="inventory-new-field">
      <label className="inventory-new-label">{label}</label>
      <textarea
        className="inventory-new-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
