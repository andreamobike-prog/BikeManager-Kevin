"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

type Product = {
  id: string;
  title: string;
  warehouse_qty: number;
  price_b2b: number | null;
};

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [preview, setPreview] = useState<any>({
    all: [],
    valid: [],
  });

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    const { data } = await supabase.from("products").select("*");
    setProducts(data || []);
  }

  /* ---------------------------------- */
  /* 🔥 AUTO MAPPING */
  /* ---------------------------------- */

  function normalize(text: string) {
    return text.toLowerCase().replace(/\s+/g, "").trim();
  }

  function toNumber(val: any) {
    if (!val) return 0;
    return Number(String(val).replace(",", ".")) || 0;
  }

  function autoMapRow(row: any) {
  return {
    title: row["Nome prodotto"],
    ean: String(row["Codice"] || ""),
    warehouse_qty: Number(row["Giacenza"] || 0),
    price_b2b: Number(row["Costo medio"] || 0),
    price_b2c: Number(row["Prezzo medio"] || 0),
    location: null,
    description: null,
  };
}

  /* ---------------------------------- */
  /* 📥 IMPORT FILE */
  /* ---------------------------------- */

  async function handleImport(file: File) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
   const json = XLSX.utils.sheet_to_json(sheet, {
  defval: "",
  range: 4, // 🔥 SALTA LE PRIME 4 RIGHE
});

    const mapped = json.map(autoMapRow);

    const valid = mapped.filter((p: any) => p.title);

    setPreview({
      all: mapped,
      valid,
    });

    setToast(`✔ ${valid.length} prodotti riconosciuti`);
  }

  /* ---------------------------------- */
  /* 💾 SALVA */
  /* ---------------------------------- */

  async function confirmImport() {
    const { error } = await supabase
      .from("products")
      .insert(preview.valid);

    if (error) {
      setToast("Errore: " + error.message);
      return;
    }

    setToast("✅ Import completato");
    setPreview({ all: [], valid: [] });

    loadProducts();
  }

  /* ---------------------------------- */
  /* UI */
  /* ---------------------------------- */

  return (
    <div style={{ padding: 40, maxWidth: 1100, margin: "auto" }}>
      <h1>Magazzino</h1>

      {/* IMPORT BUTTON */}
      <div style={{ marginBottom: 20 }}>
        <label style={button}>
          📥 Importa prodotti
          <input
            type="file"
            accept=".xls,.xlsx"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
            }}
          />
        </label>
      </div>

      {/* TOAST */}
      {toast && (
        <div style={toastStyle}>
          {toast}
        </div>
      )}

      {/* PREVIEW */}
      {preview.valid.length > 0 && (
        <div style={card}>
          <h3>Anteprima import</h3>

          <p>
            Prodotti riconosciuti: <b>{preview.valid.length}</b>
          </p>

          <table style={{ width: "100%", marginTop: 10 }}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Quantità</th>
                <th>B2B</th>
              </tr>
            </thead>

            <tbody>
              {preview.valid.slice(0, 5).map((p: any, i: number) => (
                <tr key={i}>
                  <td>{p.title}</td>
                  <td>{p.warehouse_qty}</td>
                  <td>{p.price_b2b}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <button style={button} onClick={confirmImport}>
            Conferma import
          </button>
        </div>
      )}

      {/* LISTA PRODOTTI */}
      <div style={card}>
        <h3>Prodotti</h3>

        {products.map((p) => (
          <div key={p.id} style={row}>
            <div>{p.title}</div>
            <div>{p.warehouse_qty}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- */
/* STYLE */
/* ---------------------------------- */

const button: any = {
  background: "#2563eb",
  color: "white",
  padding: "10px 16px",
  borderRadius: 8,
  cursor: "pointer",
  border: "none",
};

const card: any = {
  background: "white",
  padding: 20,
  borderRadius: 12,
  marginTop: 20,
  boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
};

const row: any = {
  display: "flex",
  justifyContent: "space-between",
  padding: "8px 0",
  borderBottom: "1px solid #eee",
};

const toastStyle: any = {
  background: "#dcfce7",
  padding: 10,
  borderRadius: 8,
  marginBottom: 10,
};