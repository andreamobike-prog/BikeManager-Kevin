"use client";

import React from "react";
import { supabase } from "@/lib/supabase";

type SupplierInsertRow = {
  name: string | null;
  email: string | null;
  phone: string | null;
  vat_number: string | null;
};

export default function ImportExportSuppliersPage() {
  async function exportCSV() {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      alert(`Errore export fornitori: ${error.message}`);
      return;
    }

    const rows = data || [];

    if (rows.length === 0) {
      alert("Nessun fornitore da esportare");
      return;
    }

    const headers = Object.keys(rows[0] as Record<string, unknown>);

    const csv = [
      headers.join(","),
      ...rows.map((row: Record<string, unknown>) =>
        headers
          .map((key) => {
            const value = row[key];
            const safe = String(value ?? "").replace(/"/g, '""');
            return `"${safe}"`;
          })
          .join(",")
      ),
    ].join("\n");

    downloadFile(csv, "suppliers.csv", "text/csv;charset=utf-8;");
  }

  async function importCSV(
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      alert("CSV vuoto o non valido.");
      return;
    }

    const headers = parseCsvLine(lines[0]).map((h) => h.trim());

    const parsed: SupplierInsertRow[] = lines.slice(1).map((line: string) => {
      const cols = parseCsvLine(line);

      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = cols[index] ?? "";
      });

      return {
        name: normalize(row.name),
        email: normalize(row.email),
        phone: normalize(row.phone),
        vat_number: normalize(row.vat_number),
      };
    });

    const cleaned = parsed.filter(
      (row) => row.name || row.email || row.phone || row.vat_number
    );

    if (cleaned.length === 0) {
      alert("Nessuna riga valida trovata nel CSV.");
      return;
    }

    const { error } = await supabase.from("suppliers").insert(cleaned);

    if (error) {
      alert(`Errore import fornitori: ${error.message}`);
      return;
    }

    alert(`Import completato. Righe inserite: ${cleaned.length}`);
    e.target.value = "";
  }

  function normalize(value: string | undefined): string | null {
    const trimmed = String(value ?? "").trim();
    return trimmed ? trimmed : null;
  }

  function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div style={page}>
      <h1 style={title}>Import / Export Fornitori</h1>
      <p style={subtitle}>
        Esporta tutti i fornitori in CSV oppure importa un file CSV con colonne:
        name, email, phone, vat_number
      </p>

      <div style={card}>
        <button onClick={exportCSV} style={primaryBtn}>
          Esporta CSV
        </button>

        <label style={uploadBox}>
          <span style={uploadText}>Importa CSV</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={importCSV}
            style={{ display: "none" }}
          />
        </label>
      </div>

      <div style={helpBox}>
        <strong>Formato consigliato CSV:</strong>
        <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: 13 }}>
          name,email,phone,vat_number
        </div>
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
  padding: 24,
  maxWidth: 900,
  margin: "0 auto",
};

const title: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  marginBottom: 8,
};

const subtitle: React.CSSProperties = {
  color: "#64748b",
  marginBottom: 20,
  lineHeight: 1.5,
};

const card: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  padding: 20,
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  background: "#fff",
};

const primaryBtn: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const uploadBox: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 700,
};

const uploadText: React.CSSProperties = {
  display: "inline-block",
};

const helpBox: React.CSSProperties = {
  marginTop: 20,
  padding: 16,
  borderRadius: 12,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};
