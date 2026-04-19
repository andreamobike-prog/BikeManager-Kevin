"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { Upload, Plus } from "lucide-react";

type CustomerType = "private" | "company";
type EventFormat = "biga_race" | "biga_adventure" | "biga_love";
type ToastType = "success" | "error" | "info";

type Customer = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  notes?: string | null;
  created_at?: string | null;
  customer_type?: CustomerType | null;
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
  biga_race?: boolean | null;
  biga_adventure?: boolean | null;
  biga_love?: boolean | null;
};

type CustomerForm = {
  name: string;
  phone: string;
  email: string;
  customer_type: CustomerType;
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
  biga_race: boolean;
  biga_adventure: boolean;
  biga_love: boolean;
};

const initialForm: CustomerForm = {
  name: "",
  phone: "",
  email: "",
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
  notes: "",
  biga_race: false,
  biga_adventure: false,
  biga_love: false,
};

export default function CustomersPage() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | CustomerType>("all");
  const [cityFilter, setCityFilter] = useState("");
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState<CustomerForm>(initialForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const [toast, setToast] = useState<{
    type: ToastType;
    message: string;
  } | null>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadCustomers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("Errore caricamento clienti:", error);
      setToast({
        type: "error",
        message: `Errore nel caricamento clienti: ${error.message}`,
      });
      setLoading(false);
      return;
    }

    setCustomers((data as Customer[]) || []);
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

  async function checkDuplicateCustomer() {
    const email = normalizeEmail(form.email);
    const taxCode = normalizeTaxCode(form.tax_code);
    const vatNumber = normalizeVat(form.vat_number);

    if (email) {
      const { data, error } = await supabase
        .from("customers")
        .select("id,name")
        .eq("email", email)
        .limit(1);

      if (!error && data && data.length > 0) {
        return `Esiste già un cliente con questa email: ${data[0].name || "cliente esistente"}`;
      }
    }

    if (taxCode) {
      const { data, error } = await supabase
        .from("customers")
        .select("id,name")
        .eq("tax_code", taxCode)
        .limit(1);

      if (!error && data && data.length > 0) {
        return `Esiste già un cliente con questo codice fiscale: ${data[0].name || "cliente esistente"}`;
      }
    }

    if (vatNumber) {
      const { data, error } = await supabase
        .from("customers")
        .select("id,name")
        .eq("vat_number", vatNumber)
        .limit(1);

      if (!error && data && data.length > 0) {
        return `Esiste già un cliente con questa partita IVA: ${data[0].name || "cliente esistente"}`;
      }
    }

    return null;
  }

  async function createCustomer() {
    if (!form.name.trim()) {
      setToast({
        type: "error",
        message: "Inserisci il nome del cliente.",
      });
      return;
    }

    const duplicateMessage = await checkDuplicateCustomer();

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
      customer_type: form.customer_type,
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
      biga_race: form.biga_race,
      biga_adventure: form.biga_adventure,
      biga_love: form.biga_love,
    };

    const { error } = await supabase.from("customers").insert(payload);

    if (error) {
      console.error("Errore inserimento cliente:", error);
      setToast({
        type: "error",
        message: `Errore nel salvataggio: ${error.message}`,
      });
      setSaving(false);
      return;
    }

    setToast({
      type: "success",
      message: "Cliente creato correttamente.",
    });

    resetForm();
    setShowModal(false);
    await loadCustomers();
    setSaving(false);
  }

  async function deleteCustomer(id: string, name: string | null) {
    const ok = window.confirm(
      `Vuoi davvero eliminare il cliente "${name || "senza nome"}"?`
    );

    if (!ok) return;

    setDeletingId(id);

    const { error } = await supabase.from("customers").delete().eq("id", id);

    if (error) {
      console.error("Errore eliminazione cliente:", error);
      setToast({
        type: "error",
        message: `Errore durante l'eliminazione: ${error.message}`,
      });
      setDeletingId(null);
      return;
    }

    setToast({
      type: "success",
      message: "Cliente eliminato correttamente.",
    });

    await loadCustomers();
    setDeletingId(null);
  }

  async function toggleEventFlag(
    customerId: string,
    field: EventFormat,
    currentValue: boolean | null | undefined
  ) {
    const key = `${customerId}-${field}`;
    setTogglingKey(key);

    const nextValue = !Boolean(currentValue);

    const { error } = await supabase
      .from("customers")
      .update({ [field]: nextValue })
      .eq("id", customerId);

    if (error) {
      console.error(`Errore aggiornamento ${field}:`, error);
      setToast({
        type: "error",
        message: `Errore aggiornamento format evento: ${error.message}`,
      });
      setTogglingKey(null);
      return;
    }

    setCustomers((prev) =>
      prev.map((customer) =>
        customer.id === customerId
          ? {
            ...customer,
            [field]: nextValue,
          }
          : customer
      )
    );

    setToast({
      type: "success",
      message: "Format evento aggiornato.",
    });

    setTogglingKey(null);
  }

  function getCustomerTypeLabel(type: CustomerType | null | undefined) {
    return type === "company" ? "Azienda" : "Privato";
  }

  function getAddressLine(customer: Customer) {
    const first = [customer.address || "", customer.address_notes || ""]
      .filter(Boolean)
      .join(" - ");

    const second = [
      customer.zip || "",
      customer.city || "",
      customer.province ? `(${customer.province})` : "",
      customer.country || "",
    ]
      .filter(Boolean)
      .join(" ");

    return [first, second].filter(Boolean).join(", ");
  }

  function exportEventXlsx(eventField: EventFormat) {
    const labels: Record<EventFormat, string> = {
      biga_race: "Gestionale Kevin Race",
      biga_adventure: "Gestionale Kevin Adventure",
      biga_love: "Gestionale Kevin Love",
    };

    const selected = customers.filter((customer) => Boolean(customer[eventField]));

    if (selected.length === 0) {
      setToast({
        type: "info",
        message: `Nessun cliente selezionato per ${labels[eventField]}.`,
      });
      return;
    }

    const rows = selected.map((customer) => ({
      nome: customer.name || "",
      tipo: getCustomerTypeLabel(customer.customer_type),
      referente: customer.contact_name || "",
      telefono: customer.phone || "",
      email: customer.email || "",
      pec: customer.pec || "",
      citta: customer.city || "",
      provincia: customer.province || "",
      indirizzo: getAddressLine(customer),
      partita_iva: customer.vat_number || "",
      codice_fiscale: customer.tax_code || "",
      biga_race: customer.biga_race ? "SI" : "NO",
      biga_adventure: customer.biga_adventure ? "SI" : "NO",
      biga_love: customer.biga_love ? "SI" : "NO",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, labels[eventField]);
    XLSX.writeFile(workbook, `${labels[eventField]}_contatti.xlsx`);

    setToast({
      type: "success",
      message: `File ${labels[eventField]} esportato correttamente.`,
    });
  }

  const uniqueCities = useMemo(() => {
    return Array.from(
      new Set(customers.map((c) => (c.city || "").trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [customers]);

  const filtered = useMemo(() => {
    let result = [...customers];
    const q = search.trim().toLowerCase();

    if (q) {
      result = result.filter((c) => {
        const text = [
          c.name || "",
          c.phone || "",
          c.email || "",
          c.customer_type || "",
          c.vat_number || "",
          c.tax_code || "",
          c.city || "",
          c.pec || "",
          c.address || "",
          c.zip || "",
          c.province || "",
          c.contact_name || "",
          c.sdi_code || "",
          c.iban || "",
          c.notes || "",
        ]
          .join(" ")
          .toLowerCase();

        return text.includes(q);
      });
    }

    if (typeFilter !== "all") {
      result = result.filter((c) => (c.customer_type || "private") === typeFilter);
    }

    if (cityFilter) {
      result = result.filter((c) => (c.city || "") === cityFilter);
    }

    return result;
  }, [customers, search, typeFilter, cityFilter]);

  const stats = useMemo(() => {
    return {
      total: customers.length,
      privateCount: customers.filter((c) => (c.customer_type || "private") === "private").length,
      companyCount: customers.filter((c) => c.customer_type === "company").length,
      raceCount: customers.filter((c) => Boolean(c.biga_race)).length,
      adventureCount: customers.filter((c) => Boolean(c.biga_adventure)).length,
      loveCount: customers.filter((c) => Boolean(c.biga_love)).length,
    };
  }, [customers]);

  return (
    <div className="app-page-shell">
      <div className="page-stack">
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

        <div className="customers-hero">
          <div className="page-header">
            <div className="page-header__left">
              <div className="apple-kicker">CRM clienti</div>
              <h1 className="apple-page-title">Clienti</h1>
              <p className="apple-page-subtitle">
                Gestisci anagrafiche, format evento, export contatti e ricerca avanzata in una sola vista.
              </p>
            </div>

            <div className="page-header__right">
              <button
                className="btn-secondary"
                onClick={() => router.push("/customers/import")}
              >
                <Upload size={16} strokeWidth={2} />
                <span>Importa clienti</span>
              </button>

              <button className="btn-primary" onClick={() => setShowModal(true)}>
                <Plus size={16} strokeWidth={2} />
                <span>Nuovo cliente</span>
              </button>
            </div>
          </div>
        </div>

        <div className="dashboard-stats-grid customers-stats-grid">
          <StatCard label="Clienti totali" value={stats.total} />
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
                <label className="apple-label">Tipo cliente</label>
                <select
                  className="apple-select"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as "all" | CustomerType)}
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
          <div className="apple-empty">Caricamento clienti...</div>
        ) : filtered.length === 0 ? (
          <div className="apple-empty">
            {search.trim() || typeFilter !== "all" || cityFilter
              ? "Nessun cliente trovato con i filtri attuali."
              : "Non ci sono ancora clienti registrati."}
          </div>
        ) : (
          <div className="customer-grid-dark">
            {filtered.map((c) => (
              <div key={c.id} className="customer-card-dark">
                <div className="customer-card-dark__top">
                  <div className="customer-card-dark__avatar">
                    {(c.name || "?").charAt(0).toUpperCase()}
                  </div>

                  <div className="customer-card-dark__main">
                    <div className="customer-card-dark__title-row">
                      <h3 className="customer-card-dark__title">{c.name || "-"}</h3>

                      <span
                        className={
                          c.customer_type === "company"
                            ? "badge badge-purple"
                            : "badge badge-blue"
                        }
                      >
                        {getCustomerTypeLabel(c.customer_type)}
                      </span>
                    </div>

                    <div className="customer-card-dark__id">ID: {c.id.slice(0, 8)}</div>
                  </div>
                </div>

                <></>

                <div className="customer-card-dark__info">
                  <InfoRow label="Referente" value={c.contact_name || "-"} />
                  <InfoRow label="Telefono" value={c.phone || "-"} />
                  <InfoRow label="Email" value={c.email || "-"} />
                  <InfoRow label="Città" value={c.city || "-"} />
                  <InfoRow label="Indirizzo" value={getAddressLine(c) || "-"} />
                  <InfoRow label="P.IVA" value={c.vat_number || "-"} />
                  <InfoRow label="Codice fiscale" value={c.tax_code || "-"} />
                </div>

                <div className="customer-card-dark__actions">
                  <button
                    className="btn-primary"
                    onClick={() => router.push(`/customers/${c.id}`)}
                  >
                    Apri scheda
                  </button>

                  <button
                    className="btn-secondary"
                    onClick={() => deleteCustomer(c.id, c.name)}
                    disabled={deletingId === c.id}
                  >
                    {deletingId === c.id ? "Eliminazione..." : "Elimina"}
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
                  <h2 className="customers-modal__title">Nuovo cliente</h2>
                  <p className="customers-modal__subtitle">
                    Crea una scheda cliente completa, assegna i format evento e prepara subito il contatto.
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
                    Identità cliente e canali di contatto.
                  </div>

                  <div className="apple-form-grid customers-form-section">
                    <></>

                    <div className="apple-field">
                      <label className="apple-label">
                        {form.customer_type === "company"
                          ? "Denominazione *"
                          : "Nome cliente *"}
                      </label>
                      <input
                        className="apple-input"
                        placeholder={
                          form.customer_type === "company"
                            ? "Es. Gestionale Kevin S.R.L."
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
                          placeholder="cliente@email.com"
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
                          placeholder="cliente@pec.it"
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
                    Informazioni amministrative e fatturazione.
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
                      placeholder="Inserisci informazioni utili sul cliente..."
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

                <button className="btn-primary" onClick={createCustomer} disabled={saving}>
                  {saving ? "Salvataggio..." : "Salva cliente"}
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

function EventToggle({
  label,
  active,
  loading,
  onClick,
}: {
  label: string;
  active: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`event-chip-dark ${active ? "active" : ""}`}
      style={{
        opacity: loading ? 0.7 : 1,
        cursor: loading ? "not-allowed" : "pointer",
      }}
    >
      {loading ? "..." : active ? `✓ ${label}` : label}
    </button>
  );
}

function EventCard({
  title,
  subtitle,
  active,
  tone,
  onClick,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  tone: "blue" | "orange" | "red";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`customer-event-card is-${tone} ${active ? "active" : ""}`}
    >
      <div className="customer-event-card__title">{title}</div>
      <div className="customer-event-card__subtitle">{subtitle}</div>
      <div className={active ? "badge badge-green" : "badge badge-gray"}>
        {active ? "✓ Attivo" : "Seleziona"}
      </div>
    </button>
  );
}
