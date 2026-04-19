"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

type CustomerType = "private" | "company";
type RowStatus = "new" | "duplicate" | "invalid" | "imported";
type ToastType = "success" | "error" | "info";

type ParsedCustomer = {
  rowNumber: number;
  source: Record<string, any>;
  name: string;
  address: string | null;
  city: string | null;
  zip: string | null;
  province: string | null;
  country: string | null;
  address_notes: string | null;
  email: string | null;
  contact_name: string | null;
  phone: string | null;
  vat_number: string | null;
  tax_code: string | null;
  notes: string | null;
  pec: string | null;
  iban: string | null;
  sdi_code: string | null;
  customer_type: CustomerType;
  status: RowStatus;
  reason?: string;
};

const REQUIRED_HEADERS = [
  "Denominazione",
  "Indirizzo",
  "Comune",
  "CAP",
  "Provincia",
  "Note indirizzo",
  "Paese",
  "Indirizzo e-mail",
  "Referente",
  "Telefono",
  "P.IVA/TAX ID",
  "Codice Fiscale",
  "Note",
  "Indirizzo PEC",
  "IBAN",
  "Codice SDI",
];

export default function CustomersImportPage() {
  const router = useRouter();

  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedCustomer[]>([]);
  const [loadingFile, setLoadingFile] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<{
    type: ToastType;
    message: string;
  } | null>(null);

  function showToast(type: ToastType, message: string) {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3200);
  }

  function normalizeText(value: any) {
    const v = String(value ?? "").trim();
    return v || null;
  }

  function normalizeEmail(value: any) {
    const v = String(value ?? "").trim().toLowerCase();
    return v || null;
  }

  function normalizeUpper(value: any) {
    const v = String(value ?? "").trim().toUpperCase();
    return v || null;
  }

  function detectCustomerType(name: string | null, vat: string | null): CustomerType {
    if (vat) return "company";

    const upperName = String(name || "").toUpperCase();

    const companyHints = [
      "SRL",
      "S.R.L",
      "SPA",
      "S.P.A",
      "SAS",
      "S.N.C",
      "SNC",
      "SOCIETA",
      "SOCIETÀ",
      "STUDIO",
      "ASSOCIAZIONE",
      "COOPERATIVA",
      "IMPRESA",
      "DITTA",
    ];

    if (companyHints.some((hint) => upperName.includes(hint))) {
      return "company";
    }

    return "private";
  }

  function validateHeaders(headers: string[]) {
    const missing = REQUIRED_HEADERS.filter((required) => !headers.includes(required));
    return missing;
  }

  function mapRow(row: Record<string, any>, index: number): ParsedCustomer {
    const name = normalizeText(row["Denominazione"]);
    const vatNumber = normalizeUpper(row["P.IVA/TAX ID"]);
    const taxCode = normalizeUpper(row["Codice Fiscale"]);

    const mapped: ParsedCustomer = {
      rowNumber: index + 2,
      source: row,
      name: name || "",
      address: normalizeText(row["Indirizzo"]),
      city: normalizeText(row["Comune"]),
      zip: normalizeText(row["CAP"]),
      province: normalizeUpper(row["Provincia"]),
      country: normalizeText(row["Paese"]),
      address_notes: normalizeText(row["Note indirizzo"]),
      email: normalizeEmail(row["Indirizzo e-mail"]),
      contact_name: normalizeText(row["Referente"]),
      phone: normalizeText(row["Telefono"]),
      vat_number: vatNumber,
      tax_code: taxCode,
      notes: normalizeText(row["Note"]),
      pec: normalizeEmail(row["Indirizzo PEC"]),
      iban: normalizeUpper(row["IBAN"]),
      sdi_code: normalizeUpper(row["Codice SDI"]),
      customer_type: detectCustomerType(name, vatNumber),
      status: "new",
    };

    if (!mapped.name) {
      mapped.status = "invalid";
      mapped.reason = "Denominazione mancante";
      return mapped;
    }

    return mapped;
  }

  async function fetchExistingSet(
    column: "email" | "vat_number" | "tax_code",
    values: string[]
  ) {
    const found = new Set<string>();
    const uniqueValues = Array.from(new Set(values.filter(Boolean)));
    const chunkSize = 50;

    for (let i = 0; i < uniqueValues.length; i += chunkSize) {
      const chunk = uniqueValues.slice(i, i + chunkSize);

      const { data, error } = await supabase
        .from("customers")
        .select(column)
        .in(column, chunk);

      if (error) {
        throw new Error(`Errore controllo duplicati su ${column}: ${error.message}`);
      }

      (data || []).forEach((item: any) => {
        const raw = item?.[column];
        if (!raw) return;
        found.add(String(raw));
      });
    }

    return found;
  }

  async function markDuplicates(mappedRows: ParsedCustomer[]) {
    const emails = mappedRows
      .map((r) => r.email)
      .filter(Boolean) as string[];

    const vatNumbers = mappedRows
      .map((r) => r.vat_number)
      .filter(Boolean) as string[];

    const taxCodes = mappedRows
      .map((r) => r.tax_code)
      .filter(Boolean) as string[];

    const existingEmails = await fetchExistingSet("email", emails);
    const existingVatNumbers = await fetchExistingSet("vat_number", vatNumbers);
    const existingTaxCodes = await fetchExistingSet("tax_code", taxCodes);

    const localEmails = new Set<string>();
    const localVatNumbers = new Set<string>();
    const localTaxCodes = new Set<string>();

    return mappedRows.map((row) => {
      if (row.status === "invalid") return row;

      const email = row.email || "";
      const vat = row.vat_number || "";
      const tax = row.tax_code || "";

      if (email && existingEmails.has(email)) {
        return {
          ...row,
          status: "duplicate" as RowStatus,
          reason: "Email già presente",
        };
      }

      if (vat && existingVatNumbers.has(vat)) {
        return {
          ...row,
          status: "duplicate" as RowStatus,
          reason: "Partita IVA già presente",
        };
      }

      if (tax && existingTaxCodes.has(tax)) {
        return {
          ...row,
          status: "duplicate" as RowStatus,
          reason: "Codice fiscale già presente",
        };
      }

      if (email && localEmails.has(email)) {
        return {
          ...row,
          status: "duplicate" as RowStatus,
          reason: "Email duplicata nel file",
        };
      }

      if (vat && localVatNumbers.has(vat)) {
        return {
          ...row,
          status: "duplicate" as RowStatus,
          reason: "Partita IVA duplicata nel file",
        };
      }

      if (tax && localTaxCodes.has(tax)) {
        return {
          ...row,
          status: "duplicate" as RowStatus,
          reason: "Codice fiscale duplicato nel file",
        };
      }

      if (email) localEmails.add(email);
      if (vat) localVatNumbers.add(vat);
      if (tax) localTaxCodes.add(tax);

      return row;
    });
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoadingFile(true);
      setCheckingDuplicates(true);
      setRows([]);
      setFileName(file.name);

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
        defval: "",
      });

      if (!rawRows.length) {
        showToast("error", "Il file è vuoto o non contiene righe leggibili.");
        return;
      }

      const headers = Object.keys(rawRows[0] || {});
      const missingHeaders = validateHeaders(headers);

      if (missingHeaders.length > 0) {
        showToast(
          "error",
          `File non compatibile. Mancano queste colonne: ${missingHeaders.join(", ")}`
        );
        return;
      }

      const mappedRows = rawRows.map((row, index) => mapRow(row, index));
      const checkedRows = await markDuplicates(mappedRows);

      setRows(checkedRows);

      showToast(
        "success",
        `File analizzato correttamente: ${checkedRows.length} righe trovate.`
      );
    } catch (error: any) {
      console.error("ERRORE IMPORT CLIENTI:", error);
      showToast(
        "error",
        error?.message || "Errore durante la lettura del file."
      );
    } finally {
      setLoadingFile(false);
      setCheckingDuplicates(false);
      event.target.value = "";
    }
  }

  async function importCustomers() {
    const importableRows = rows.filter((row) => row.status === "new");

    if (!importableRows.length) {
      showToast("info", "Non ci sono clienti nuovi da importare.");
      return;
    }

    try {
      setImporting(true);

      const payload = importableRows.map((row) => ({
        name: row.name,
        customer_type: row.customer_type,
        address: row.address,
        city: row.city,
        zip: row.zip,
        province: row.province,
        country: row.country,
        address_notes: row.address_notes,
        contact_name: row.contact_name,
        email: row.email,
        phone: row.phone,
        vat_number: row.vat_number,
        tax_code: row.tax_code,
        notes: row.notes,
        pec: row.pec,
        iban: row.iban,
        sdi_code: row.sdi_code,
      }));

      const { error } = await supabase.from("customers").insert(payload);

      if (error) {
        throw new Error(error.message);
      }

      setRows((prev) =>
        prev.map((row) =>
          row.status === "new"
            ? {
              ...row,
              status: "imported",
              reason: "Importato",
            }
            : row
        )
      );

      showToast("success", `${payload.length} clienti importati correttamente.`);
    } catch (error: any) {
      console.error("ERRORE IMPORT:", error);
      showToast("error", error?.message || "Errore durante l'importazione.");
    } finally {
      setImporting(false);
    }
  }

  const stats = useMemo(() => {
    return {
      total: rows.length,
      newCount: rows.filter((row) => row.status === "new").length,
      duplicateCount: rows.filter((row) => row.status === "duplicate").length,
      invalidCount: rows.filter((row) => row.status === "invalid").length,
      importedCount: rows.filter((row) => row.status === "imported").length,
    };
  }, [rows]);

  return (
    <div className="customers-import-page">
      {toast && (
        <div
          className={`customers-import-toast ${toast.type === "success"
              ? "customers-import-toast--success"
              : toast.type === "error"
                ? "customers-import-toast--error"
                : "customers-import-toast--info"
            }`}
        >
          {toast.message}
        </div>
      )}

      <div className="customers-import-container">
        <div className="customers-import-header">
          <div>
            <h1 className="customers-import-title">Importa clienti</h1>
            <p className="customers-import-subtitle">
              Pagina compatibile con l’export clienti di Fatture in Cloud. I duplicati
              vengono rilevati e non vengono sovrascritti.
            </p>
          </div>

          <div className="customers-import-header-actions">
            <button
              className="customers-import-secondary-btn"
              onClick={() => router.push("/customers")}
            >
              ← Torna ai clienti
            </button>
          </div>
        </div>

        <div className="customers-import-upload-card">
          <div className="customers-import-upload-title">Carica file Fatture in Cloud</div>
          <div className="customers-import-upload-sub">
            File supportati: .xlsx, .xls, .csv
          </div>

          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="customers-import-file-input"
          />

          {fileName ? (
            <div className="customers-import-file-name">File selezionato: {fileName}</div>
          ) : null}
        </div>

        <div className="customers-import-stats-grid">
          <StatCard label="Righe lette" value={stats.total} />
          <StatCard label="Nuovi" value={stats.newCount} />
          <StatCard label="Duplicati" value={stats.duplicateCount} />
          <StatCard label="Non validi" value={stats.invalidCount} />
          <StatCard label="Importati" value={stats.importedCount} />
        </div>

        <div className="customers-import-action-bar">
          <button
            className="customers-import-primary-btn"
            onClick={importCustomers}
            disabled={
              importing || loadingFile || checkingDuplicates || stats.newCount === 0
            }
          >
            {importing ? "Importazione..." : `Importa ${stats.newCount} clienti`}
          </button>
        </div>

                <div className="customers-import-table-wrap">
          {loadingFile || checkingDuplicates ? (
            <div className="customers-import-empty-state">Analisi file in corso...</div>
          ) : rows.length === 0 ? (
            <div className="customers-import-empty-state">
              Nessun file caricato. Seleziona un file per vedere l’anteprima.
            </div>
          ) : (
            <table className="customers-import-table">
              <thead>
                <tr>
                  <th className="customers-import-th">Riga</th>
                  <th className="customers-import-th">Denominazione</th>
                  <th className="customers-import-th">Tipo</th>
                  <th className="customers-import-th">Email</th>
                  <th className="customers-import-th">Telefono</th>
                  <th className="customers-import-th">P.IVA</th>
                  <th className="customers-import-th">CF</th>
                  <th className="customers-import-th">Comune</th>
                  <th className="customers-import-th">Stato</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.rowNumber}-${row.name}`} className="customers-import-tr">
                    <td className="customers-import-td">{row.rowNumber}</td>
                    <td className="customers-import-td customers-import-td--strong">
                      {row.name || "-"}
                    </td>
                    <td className="customers-import-td">
                      {row.customer_type === "company" ? "Azienda" : "Privato"}
                    </td>
                    <td className="customers-import-td">{row.email || "-"}</td>
                    <td className="customers-import-td">{row.phone || "-"}</td>
                    <td className="customers-import-td">{row.vat_number || "-"}</td>
                    <td className="customers-import-td">{row.tax_code || "-"}</td>
                    <td className="customers-import-td">{row.city || "-"}</td>
                    <td className="customers-import-td">
                      {row.status === "new" && (
                        <span className="customers-import-badge customers-import-badge--new">
                          Nuovo
                        </span>
                      )}

                      {row.status === "duplicate" && (
                        <span className="customers-import-badge customers-import-badge--duplicate">
                          {row.reason ? `Duplicato · ${row.reason}` : "Duplicato"}
                        </span>
                      )}

                      {row.status === "invalid" && (
                        <span className="customers-import-badge customers-import-badge--invalid">
                          {row.reason ? `Non valido · ${row.reason}` : "Non valido"}
                        </span>
                      )}

                      {row.status === "imported" && (
                        <span className="customers-import-badge customers-import-badge--imported">
                          Importato
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="customers-import-stat-card">
      <div className="customers-import-stat-label">{label}</div>
      <div className="customers-import-stat-value">{value}</div>
    </div>
  );
}