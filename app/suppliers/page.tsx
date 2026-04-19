"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Upload, Plus } from "lucide-react";

type SupplierType = "private" | "company";
type ToastType = "success" | "error" | "info";

type Supplier = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  notes?: string | null;
  created_at?: string | null;
  supplier_type?: SupplierType | null;
  vat_number?: string | null;
  tax_code?: string | null;
  address?: string | null;
  city?: string | null;
  zip?: string | null;
  province?: string | null;
  country?: string | null;
  address_notes?: string | null;
  contact_name?: string | null;
  pec?: string | null;
  iban?: string | null;
  sdi_code?: string | null;
};

type SupplierForm = {
  name: string;
  phone: string;
  email: string;
  supplier_type: SupplierType;
  vat_number: string;
  tax_code: string;
  address: string;
  city: string;
  zip: string;
  province: string;
  country: string;
  address_notes: string;
  contact_name: string;
  pec: string;
  iban: string;
  sdi_code: string;
  notes: string;
};

const initialForm: SupplierForm = {
  name: "",
  phone: "",
  email: "",
  supplier_type: "company",
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
  notes: "",
};

export default function SuppliersPage() {
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | SupplierType>("all");
  const [cityFilter, setCityFilter] = useState("");
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState<SupplierForm>(initialForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [toast, setToast] = useState<{
    type: ToastType;
    message: string;
  } | null>(null);

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadSuppliers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("Errore caricamento fornitori:", error);
      setToast({
        type: "error",
        message: `Errore nel caricamento fornitori: ${error.message}`,
      });
      setLoading(false);
      return;
    }

    setSuppliers((data as Supplier[]) || []);
    setLoading(false);
  }

  function resetForm() {
    setForm(initialForm);
  }

  function normalizeEmail(value: string) {
    return value.trim().toLowerCase();
  }

  function normalizeTaxCode(value: string) {
    return value.trim().toUpperCase();
  }

  function normalizeVat(value: string) {
    return value.trim().toUpperCase();
  }

  function normalizePec(value: string) {
    return value.trim().toLowerCase();
  }

  async function checkDuplicateSupplier() {
    const email = normalizeEmail(form.email);
    const taxCode = normalizeTaxCode(form.tax_code);
    const vatNumber = normalizeVat(form.vat_number);

    if (email) {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id,name")
        .eq("email", email)
        .limit(1);

      if (!error && data && data.length > 0) {
        return `Esiste già un fornitore con questa email: ${data[0].name || "fornitore esistente"}`;
      }
    }

    if (taxCode) {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id,name")
        .eq("tax_code", taxCode)
        .limit(1);

      if (!error && data && data.length > 0) {
        return `Esiste già un fornitore con questo codice fiscale: ${data[0].name || "fornitore esistente"}`;
      }
    }

    if (vatNumber) {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id,name")
        .eq("vat_number", vatNumber)
        .limit(1);

      if (!error && data && data.length > 0) {
        return `Esiste già un fornitore con questa partita IVA: ${data[0].name || "fornitore esistente"}`;
      }
    }

    return null;
  }

  async function createSupplier() {
    if (!form.name.trim()) {
      setToast({
        type: "error",
        message: "Inserisci il nome del fornitore.",
      });
      return;
    }

    const duplicateMessage = await checkDuplicateSupplier();

    if (duplicateMessage) {
      setToast({
        type: "error",
        message: duplicateMessage,
      });
      return;
    }

    setSaving(true);

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: normalizeEmail(form.email) || null,
      supplier_type: form.supplier_type,
      vat_number: normalizeVat(form.vat_number) || null,
      tax_code: normalizeTaxCode(form.tax_code) || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      zip: form.zip.trim() || null,
      province: form.province.trim().toUpperCase() || null,
      country: form.country.trim() || null,
      address_notes: form.address_notes.trim() || null,
      contact_name: form.contact_name.trim() || null,
      pec: normalizePec(form.pec) || null,
      iban: form.iban.trim().toUpperCase() || null,
      sdi_code: form.sdi_code.trim().toUpperCase() || null,
      notes: form.notes.trim() || null,
    };

    const { error } = await supabase.from("suppliers").insert(payload);

    if (error) {
  console.error("Errore inserimento fornitore:", {
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    code: error?.code,
    error,
  });

  setToast({
    type: "error",
    message: `Errore nel salvataggio: ${error.message}`,
  });
  setSaving(false);
  return;
}

    setToast({
      type: "success",
      message: "Fornitore creato correttamente.",
    });

    resetForm();
    setShowModal(false);
    await loadSuppliers();
    setSaving(false);
  }

  async function deleteSupplier(id: string, name: string | null) {
    const ok = window.confirm(
      `Vuoi davvero eliminare il fornitore "${name || "senza nome"}"?`
    );

    if (!ok) return;

    setDeletingId(id);

    const { error } = await supabase.from("suppliers").delete().eq("id", id);

    if (error) {
      console.error("Errore eliminazione fornitore:", error);
      setToast({
        type: "error",
        message: `Errore durante l'eliminazione: ${error.message}`,
      });
      setDeletingId(null);
      return;
    }

    setToast({
      type: "success",
      message: "Fornitore eliminato correttamente.",
    });

    await loadSuppliers();
    setDeletingId(null);
  }

  function getSupplierTypeLabel(type: SupplierType | null | undefined) {
    return type === "company" ? "Azienda" : "Privato";
  }

  function getAddressLine(supplier: Supplier) {
    const first = [supplier.address || "", supplier.address_notes || ""]
      .filter(Boolean)
      .join(" - ");

    const second = [
      supplier.zip || "",
      supplier.city || "",
      supplier.province ? `(${supplier.province})` : "",
      supplier.country || "",
    ]
      .filter(Boolean)
      .join(" ");

    return [first, second].filter(Boolean).join(", ");
  }

  const uniqueCities = useMemo(() => {
    return Array.from(
      new Set(suppliers.map((s) => (s.city || "").trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [suppliers]);

  const filtered = useMemo(() => {
    let result = [...suppliers];
    const q = search.trim().toLowerCase();

    if (q) {
      result = result.filter((s) => {
        const text = [
          s.name || "",
          s.phone || "",
          s.email || "",
          s.supplier_type || "",
          s.vat_number || "",
          s.tax_code || "",
          s.city || "",
          s.pec || "",
          s.address || "",
          s.zip || "",
          s.province || "",
          s.contact_name || "",
          s.sdi_code || "",
          s.iban || "",
          s.notes || "",
        ]
          .join(" ")
          .toLowerCase();

        return text.includes(q);
      });
    }

    if (typeFilter !== "all") {
      result = result.filter((s) => (s.supplier_type || "private") === typeFilter);
    }

    if (cityFilter) {
      result = result.filter((s) => (s.city || "") === cityFilter);
    }

    return result;
  }, [suppliers, search, typeFilter, cityFilter]);

  const stats = useMemo(() => {
    return {
      total: suppliers.length,
      privateCount: suppliers.filter((s) => (s.supplier_type || "company") === "private").length,
      companyCount: suppliers.filter((s) => (s.supplier_type || "company") === "company").length,
    };
  }, [suppliers]);

  return (
    <div className="app-page-shell">
      <div className="page-stack">
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

        <div className="customers-hero">
          <div className="page-header">
            <div className="page-header__left">
              <div className="apple-kicker">Anagrafica fornitori</div>
              <h1 className="apple-page-title">Fornitori</h1>
              <p className="apple-page-subtitle">
                Gestisci anagrafiche, dati fiscali, contatti e ricerca avanzata in una sola vista.
              </p>
            </div>

            <div className="page-header__right">
              <button
                className="btn-secondary"
                onClick={() => router.push("/suppliers/import")}
              >
                <Upload size={16} strokeWidth={2} />
                <span>Importa fornitori</span>
              </button>

              <button className="btn-primary" onClick={() => setShowModal(true)}>
                <Plus size={16} strokeWidth={2} />
                <span>Nuovo fornitore</span>
              </button>
            </div>
          </div>
        </div>

        <div className="dashboard-stats-grid customers-stats-grid">
          <StatCard label="Fornitori totali" value={stats.total} />
          <StatCard label="Privati" value={stats.privateCount} />
          <StatCard label="Aziende" value={stats.companyCount} />
        </div>

        <div className="apple-panel customers-filters-panel">
          <div className="apple-form-grid customers-filters-grid">
            <div className="apple-form-grid three">
              <div className="apple-field customers-search-field">
                <label className="apple-label">Ricerca</label>
                <input
                  className="apple-input"
                  placeholder="Nome, email, telefono, città, P.IVA, CF, PEC..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="apple-field">
                <label className="apple-label">Tipo fornitore</label>
                <select
                  className="apple-select"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as "all" | SupplierType)}
                >
                  <option value="all">Tutti</option>
                  <option value="private">Privati</option>
                  <option value="company">Aziende</option>
                </select>
              </div>
            </div>

            <div className="apple-form-grid three">
              <div className="apple-field">
                <label className="apple-label">Città</label>
                <select
                  className="apple-select"
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                >
                  <option value="">Tutte</option>
                  {uniqueCities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              <></>

              <div className="apple-field">
                <label className="apple-label">&nbsp;</label>
                <button
                  className="movements-reset-btn"
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("all");
                    setCityFilter("");
                  }}
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="customers-results-count">
              Risultati visualizzati: <strong>{filtered.length}</strong>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="apple-empty">Caricamento fornitori...</div>
        ) : filtered.length === 0 ? (
          <div className="apple-empty">
            {search.trim() || typeFilter !== "all" || cityFilter
              ? "Nessun fornitore trovato con i filtri attuali."
              : "Non ci sono ancora fornitori registrati."}
          </div>
        ) : (
          <div className="customer-grid-dark">
            {filtered.map((s) => (
              <div key={s.id} className="customer-card-dark">
                <div className="customer-card-dark__top">
                  <div className="customer-card-dark__avatar">
                    {(s.name || "?").charAt(0).toUpperCase()}
                  </div>

                  <div className="customer-card-dark__main">
                    <div className="customer-card-dark__title-row">
                      <h3 className="customer-card-dark__title">{s.name || "-"}</h3>

                      <span
                        className={
                          s.supplier_type === "company"
                            ? "badge badge-purple"
                            : "badge badge-blue"
                        }
                      >
                        {getSupplierTypeLabel(s.supplier_type)}
                      </span>
                    </div>

                    <div className="customer-card-dark__id">ID: {s.id.slice(0, 8)}</div>
                  </div>
                </div>

                <div className="customer-card-dark__info">
                  <InfoRow label="Referente" value={s.contact_name || "-"} />
                  <InfoRow label="Telefono" value={s.phone || "-"} />
                  <InfoRow label="Email" value={s.email || "-"} />
                  <InfoRow label="Città" value={s.city || "-"} />
                  <InfoRow label="Indirizzo" value={getAddressLine(s) || "-"} />
                  <InfoRow label="P.IVA" value={s.vat_number || "-"} />
                  <InfoRow label="Codice fiscale" value={s.tax_code || "-"} />
                </div>

                <div className="customer-card-dark__actions">
                  <button
                    className="btn-primary"
                    onClick={() => router.push(`/suppliers/${s.id}`)}
                  >
                    Apri scheda
                  </button>

                  <button
                    className="btn-secondary"
                    onClick={() => deleteSupplier(s.id, s.name)}
                    disabled={deletingId === s.id}
                  >
                    {deletingId === s.id ? "Eliminazione..." : "Elimina"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showModal && (
          <div className="apple-modal-overlay">
            <div className="apple-modal customers-modal">
              <div className="customers-modal__header">
                <div>
                  <div className="apple-kicker customers-modal__kicker">Nuova anagrafica</div>
                  <h2 className="customers-modal__title">Nuovo fornitore</h2>
                  <p className="customers-modal__subtitle">
                    Crea una scheda fornitore completa e prepara subito l'anagrafica amministrativa e di contatto.
                  </p>
                </div>

                <button
                  className="btn-secondary customers-modal__close"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  disabled={saving}
                >
                  ✕
                </button>
              </div>

              <div className="page-stack">
                <section className="apple-panel">
                  <div className="apple-kicker">Dati principali</div>
                  <div className="apple-page-subtitle customers-section-subtitle">
                    Identità fornitore e canali di contatto.
                  </div>

                  <div className="apple-form-grid customers-form-section">
                    <div className="apple-field">
                      <label className="apple-label">Tipo fornitore</label>
                      <select
                        className="apple-select"
                        value={form.supplier_type}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            supplier_type: e.target.value as SupplierType,
                          }))
                        }
                      >
                        <option value="company">Azienda</option>
                        <option value="private">Privato</option>
                      </select>
                    </div>

                    <div className="apple-field">
                      <label className="apple-label">
                        {form.supplier_type === "company"
                          ? "Denominazione *"
                          : "Nome fornitore *"}
                      </label>
                      <input
                        className="apple-input"
                        placeholder={
                          form.supplier_type === "company"
                            ? "Es. Forniture Rossi S.R.L."
                            : "Es. Mario Rossi"
                        }
                        value={form.name}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, name: e.target.value }))
                        }
                      />
                    </div>

                    <div className="apple-form-grid two">
                      <div className="apple-field">
                        <label className="apple-label">Referente</label>
                        <input
                          className="apple-input"
                          placeholder="Es. Andrea Loiudice"
                          value={form.contact_name}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              contact_name: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="apple-field">
                        <label className="apple-label">Telefono</label>
                        <input
                          className="apple-input"
                          placeholder="+39 333 1234567"
                          value={form.phone}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, phone: e.target.value }))
                          }
                        />
                      </div>
                    </div>

                    <div className="apple-form-grid two">
                      <div className="apple-field">
                        <label className="apple-label">Email</label>
                        <input
                          className="apple-input"
                          placeholder="fornitore@email.com"
                          value={form.email}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, email: e.target.value }))
                          }
                        />
                      </div>

                      <div className="apple-field">
                        <label className="apple-label">PEC</label>
                        <input
                          className="apple-input"
                          placeholder="fornitore@pec.it"
                          value={form.pec}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, pec: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <section className="apple-panel">
                  <div className="apple-kicker">Dati fiscali</div>
                  <div className="apple-page-subtitle customers-section-subtitle">
                    Informazioni amministrative e di fatturazione.
                  </div>

                  <div className="apple-form-grid customers-form-section">
                    <div className="apple-form-grid three">
                      <div className="apple-field">
                        <label className="apple-label">P.IVA</label>
                        <input
                          className="apple-input"
                          value={form.vat_number}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              vat_number: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="apple-field">
                        <label className="apple-label">Codice fiscale</label>
                        <input
                          className="apple-input"
                          value={form.tax_code}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              tax_code: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="apple-field">
                        <label className="apple-label">Codice SDI</label>
                        <input
                          className="apple-input"
                          value={form.sdi_code}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              sdi_code: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="apple-field">
                      <label className="apple-label">IBAN</label>
                      <input
                        className="apple-input"
                        value={form.iban}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, iban: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                </section>

                <section className="apple-panel">
                  <div className="apple-kicker">Indirizzo</div>
                  <div className="apple-page-subtitle customers-section-subtitle">
                    Dati geografici utili per anagrafica e contatti.
                  </div>

                  <div className="apple-form-grid customers-form-section">
                    <div className="apple-field">
                      <label className="apple-label">Indirizzo</label>
                      <input
                        className="apple-input"
                        value={form.address}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, address: e.target.value }))
                        }
                      />
                    </div>

                    <div className="apple-form-grid three">
                      <div className="apple-field">
                        <label className="apple-label">Città</label>
                        <input
                          className="apple-input"
                          value={form.city}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, city: e.target.value }))
                          }
                        />
                      </div>

                      <div className="apple-field">
                        <label className="apple-label">CAP</label>
                        <input
                          className="apple-input"
                          value={form.zip}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, zip: e.target.value }))
                          }
                        />
                      </div>

                      <div className="apple-field">
                        <label className="apple-label">Provincia</label>
                        <input
                          className="apple-input"
                          value={form.province}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, province: e.target.value }))
                          }
                        />
                      </div>
                    </div>

                    <div className="apple-form-grid two">
                      <div className="apple-field">
                        <label className="apple-label">Paese</label>
                        <input
                          className="apple-input"
                          value={form.country}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, country: e.target.value }))
                          }
                        />
                      </div>

                      <div className="apple-field">
                        <label className="apple-label">Note indirizzo</label>
                        <input
                          className="apple-input"
                          value={form.address_notes}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              address_notes: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <section className="apple-panel">
                  <div className="apple-kicker">Note interne</div>
                  <div className="apple-page-subtitle customers-section-subtitle">
                    Appunti rapidi visibili solo nel gestionale.
                  </div>

                  <div className="apple-field customers-notes-field">
                    <label className="apple-label">Note</label>
                    <textarea
                      className="apple-textarea"
                      placeholder="Inserisci informazioni utili sul fornitore..."
                      value={form.notes}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, notes: e.target.value }))
                      }
                    />
                  </div>
                </section>
              </div>

              <div className="customers-modal__actions">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  disabled={saving}
                >
                  Annulla
                </button>

                <button className="btn-primary" onClick={createSupplier} disabled={saving}>
                  {saving ? "Salvataggio..." : "Salva fornitore"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="dashboard-metric-card customers-metric-card">
      <div className="dashboard-metric-value">{value}</div>
      <div className="dashboard-metric-label">{label}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="customer-card-dark__info-row">
      <span className="customer-card-dark__info-label">{label}</span>
      <span className="customer-card-dark__info-value">{value}</span>
    </div>
  );
}