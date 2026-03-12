"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import html2pdf from "html2pdf.js";

type Customer = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
};

type Bike = {
  brand?: string | null;
  model?: string | null;
  serial?: string | null;
  color?: string | null;
};

type WorkOrder = {
  id: string;
  notes?: string | null;
  created_at?: string | null;
  customers?: Customer | null;
  bikes?: Bike[] | null;
};

type Product = {
  id: string;
  title?: string | null;
  ean?: string | null;
  price_b2c?: number | null;
};

type Part = {
  id: string;
  product_id: string;
  quantity: number;
  price_snapshot?: number | null;
  custom_price?: number | null;
  billable: boolean;
};

type Service = {
  id: string;
  title: string;
  hours?: number | null;
  notes?: string | null;
  custom_price?: number | null;
  service_date?: string | null;
};

type ComputedPart = Part & {
  productTitle: string;
  productEan: string;
  originalPrice: number;
  appliedPrice: number;
  modified: boolean;
  rowTotal: number;
};

type ComputedService = Service & {
  calculatedPrice: number;
  appliedPrice: number;
  modified: boolean;
};

export default function WorkOrderReport() {
  const params = useParams();
  const id = String(params.id);

  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const hourlyRate = 35;

  async function loadData() {
    setLoading(true);

    const [
      { data: orderData },
      { data: productData },
      { data: partsData },
      { data: servicesData },
    ] = await Promise.all([
      supabase
        .from("work_orders")
        .select(`*, customers(*), bikes(*)`)
        .eq("id", id)
        .single(),
      supabase.from("products").select("*"),
      supabase.from("work_order_parts").select("*").eq("work_order_id", id),
      supabase
        .from("work_order_services")
        .select("*")
        .eq("work_order_id", id)
        .order("service_date", { ascending: true }),
    ]);

    setOrder((orderData as WorkOrder) || null);
    setProducts((productData as Product[]) || []);
    setParts((partsData as Part[]) || []);
    setServices((servicesData as Service[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const productsMap = useMemo(() => {
    const map: Record<string, Product> = {};
    products.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [products]);

  const partsComputed: ComputedPart[] = useMemo(() => {
    return parts.map((p) => {
      const product = productsMap[p.product_id];
      const originalPrice = p.price_snapshot ?? product?.price_b2c ?? 0;
      const appliedPrice = p.custom_price ?? originalPrice;
      const modified =
        p.custom_price !== null &&
        p.custom_price !== undefined &&
        Number(p.custom_price) !== Number(originalPrice);

      return {
        ...p,
        productTitle: product?.title || "-",
        productEan: product?.ean || "-",
        originalPrice,
        appliedPrice,
        modified,
        rowTotal: appliedPrice * p.quantity,
      };
    });
  }, [parts, productsMap]);

  const servicesComputed: ComputedService[] = useMemo(() => {
    return services.map((s) => {
      const calculatedPrice = (s.hours || 0) * hourlyRate;
      const appliedPrice = s.custom_price ?? calculatedPrice;
      const modified =
        s.custom_price !== null &&
        s.custom_price !== undefined &&
        Number(s.custom_price) !== Number(calculatedPrice);

      return {
        ...s,
        calculatedPrice,
        appliedPrice,
        modified,
      };
    });
  }, [services]);

  const partsTotal = partsComputed.reduce((acc, p) => acc + p.rowTotal, 0);

  const serviceTotal = servicesComputed.reduce(
    (acc, s) => acc + s.appliedPrice,
    0
  );

  const total = partsTotal + serviceTotal;

  const firstBike = order?.bikes?.[0] ?? null;
  const bikeName = `${firstBike?.brand || ""} ${firstBike?.model || ""}`.trim();

  function formatCurrency(value: number | null | undefined) {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(Number(value || 0));
  }

  function formatDate(value: string | null | undefined) {
    if (!value) return "-";
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  }

  function downloadPDF() {
    const element = document.getElementById("report");

    if (!element) return;

    const opt = {
      margin: 10,
      filename: `report-${order?.id || "workorder"}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: {
        unit: "mm" as const,
        format: "a4" as const,
        orientation: "portrait" as const,
      },
    };

    html2pdf().set(opt).from(element).save();
  }

  function openEmailDraft() {
    if (!order) return;

    const recipient = order.customers?.email || "";
    const customerName = order.customers?.name || "cliente";
    const subject = `Scheda lavoro ${order.id} - ${bikeName || "Bici"}`;

    const body = [
      `Ciao ${customerName},`,
      ``,
      `ti inviamo il riepilogo della scheda lavoro ${order.id}.`,
      ``,
      `Totale ricambi: ${formatCurrency(partsTotal)}`,
      `Totale manodopera: ${formatCurrency(serviceTotal)}`,
      `Totale complessivo: ${formatCurrency(total)}`,
      ``,
      `Nota: il PDF va eventualmente allegato manualmente dopo il download.`,
      ``,
      `Grazie,`,
      `Biga Bike`,
    ].join("\n");

    const mailto = `mailto:${encodeURIComponent(
      recipient
    )}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
  }

  if (!order || loading) {
    return <div style={{ padding: 40 }}>Caricamento...</div>;
  }

  return (
    <div id="report" className="report-container">
      <style jsx global>{`
        @page {
          size: A4;
          margin: 18mm;
        }

        body {
          background: #f3f4f6;
          font-family: Inter, Arial, Helvetica, sans-serif;
        }

        .report-container {
          max-width: 980px;
          margin: 28px auto;
          padding: 36px;
          background: white;
          color: #111827;
          border-radius: 20px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.08);
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 28px;
        }

        th {
          border-bottom: 2px solid #111827;
          padding: 10px 8px;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: #475569;
          text-align: left;
        }

        td {
          border-bottom: 1px solid #e5e7eb;
          padding: 10px 8px;
          font-size: 14px;
          vertical-align: top;
        }

        @media print {
          .print-buttons {
            display: none !important;
          }

          body {
            background: white;
          }

          .report-container {
            margin: 0;
            padding: 0;
            box-shadow: none;
            border-radius: 0;
            max-width: 100%;
          }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 20,
          marginBottom: 28,
          flexWrap: "wrap",
        }}
      >
        <div>
          <img src="/bigalogo.png" alt="Biga Bike" style={{ height: 64 }} />
        </div>

        <div style={{ textAlign: "right" }}>
          <h1 style={{ margin: 0, fontSize: 28 }}>Scheda lavoro</h1>
          <div style={{ marginTop: 8, color: "#64748b" }}>
            ID lavoro: {order.id}
          </div>
          <div style={{ color: "#64748b" }}>
            Data report: {formatDate(new Date().toISOString())}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr",
          gap: 18,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 18,
            background: "#fafafa",
          }}
        >
          <div style={boxTitle}>Cliente</div>
          <div style={infoLine}>
            <strong>Nome:</strong> {order.customers?.name || "-"}
          </div>
          <div style={infoLine}>
            <strong>Telefono:</strong> {order.customers?.phone || "-"}
          </div>
          <div style={infoLine}>
            <strong>Email:</strong> {order.customers?.email || "-"}
          </div>
        </div>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 18,
            background: "#fafafa",
          }}
        >
          <div style={boxTitle}>Bici</div>
          <div style={infoLine}>
            <strong>Modello:</strong> {firstBike?.brand || "-"}{" "}
            {firstBike?.model || ""}
          </div>
          <div style={infoLine}>
            <strong>Telaio:</strong> {firstBike?.serial || "-"}
          </div>
          <div style={infoLine}>
            <strong>Colore:</strong> {firstBike?.color || "-"}
          </div>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 18,
          marginBottom: 32,
          background: "#fff",
        }}
      >
        <div style={boxTitle}>Note scheda</div>
        <div style={{ color: "#334155", lineHeight: 1.5 }}>
          {order.notes || "Nessuna nota inserita."}
        </div>
      </div>

      <h3 style={sectionTitle}>Ricambi utilizzati</h3>

      <table>
        <thead>
          <tr>
            <th>Prodotto</th>
            <th>Q.tà</th>
            <th>Listino</th>
            <th>Prezzo applicato</th>
            <th>Indicatore interno</th>
            <th>Totale riga</th>
          </tr>
        </thead>

        <tbody>
          {partsComputed.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", color: "#64748b" }}>
                Nessun ricambio inserito.
              </td>
            </tr>
          ) : (
            partsComputed.map((p) => (
              <tr key={p.id}>
                <td>
                  <div style={{ fontWeight: 700 }}>{p.productTitle}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    EAN: {p.productEan}
                  </div>
                </td>

                <td style={{ textAlign: "center" }}>{p.quantity}</td>

                <td style={{ textAlign: "right" }}>
                  {formatCurrency(p.originalPrice)}
                </td>

                <td style={{ textAlign: "right" }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 4,
                    }}
                  >
                    {p.modified && (
                      <span
                        style={{
                          fontSize: 11,
                          color: "#b45309",
                          background: "#fef3c7",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontWeight: 700,
                        }}
                      >
                        Prezzo modificato
                      </span>
                    )}
                    <strong>{formatCurrency(p.appliedPrice)}</strong>
                  </div>
                </td>

                <td style={{ textAlign: "center" }}>
                  <span
                    style={{
                      ...pillBase,
                      ...(p.billable ? pillGreen : pillGray),
                    }}
                  >
                    {p.billable ? "Fatturabile" : "Interno"}
                  </span>
                </td>

                <td style={{ textAlign: "right" }}>
                  <strong>{formatCurrency(p.rowTotal)}</strong>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <h3 style={sectionTitle}>Interventi officina</h3>

      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Intervento</th>
            <th>Ore</th>
            <th>Prezzo calcolato</th>
            <th>Prezzo applicato</th>
            <th>Note</th>
          </tr>
        </thead>

        <tbody>
          {servicesComputed.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", color: "#64748b" }}>
                Nessun intervento inserito.
              </td>
            </tr>
          ) : (
            servicesComputed.map((s) => (
              <tr key={s.id}>
                <td>{formatDate(s.service_date)}</td>
                <td style={{ fontWeight: 700 }}>{s.title}</td>
                <td style={{ textAlign: "center" }}>{s.hours || 0}</td>
                <td style={{ textAlign: "right" }}>
                  {formatCurrency(s.calculatedPrice)}
                </td>
                <td style={{ textAlign: "right" }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 4,
                    }}
                  >
                    {s.modified && (
                      <span
                        style={{
                          fontSize: 11,
                          color: "#b45309",
                          background: "#fef3c7",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontWeight: 700,
                        }}
                      >
                        Prezzo modificato
                      </span>
                    )}
                    <strong>{formatCurrency(s.appliedPrice)}</strong>
                  </div>
                </td>
                <td>{s.notes || "-"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div
        style={{
          marginTop: 14,
          borderTop: "2px solid #111827",
          paddingTop: 20,
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 18,
          alignItems: "start",
        }}
      >
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 16,
          }}
        >
          <div style={boxTitle}>Riepilogo report</div>
          <div style={summaryRow}>
            <span>Ricambi</span>
            <strong>{formatCurrency(partsTotal)}</strong>
          </div>
          <div style={summaryRow}>
            <span>Manodopera</span>
            <strong>{formatCurrency(serviceTotal)}</strong>
          </div>
        </div>

        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 16,
            padding: 18,
          }}
        >
          <div style={{ fontSize: 13, color: "#1d4ed8", marginBottom: 8 }}>
            Totale cliente
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#0f172a" }}>
            {formatCurrency(total)}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 60,
          display: "flex",
          justifyContent: "space-between",
          gap: 30,
        }}
      >
        <div style={{ flex: 1 }}>
          <p style={{ marginBottom: 36 }}>Firma cliente</p>
          <div style={{ borderBottom: "1px solid black", height: 36 }} />
        </div>

        <div style={{ flex: 1 }}>
          <p style={{ marginBottom: 36 }}>Firma officina</p>
          <div style={{ borderBottom: "1px solid black", height: 36 }} />
        </div>
      </div>

      <div
        className="print-buttons"
        style={{
          marginTop: 40,
          display: "flex",
          justifyContent: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <button onClick={() => window.print()} style={actionBlueBtn}>
          🖨 Stampa
        </button>

        <button onClick={downloadPDF} style={actionGreenBtn}>
          📄 Scarica PDF
        </button>

        <button onClick={openEmailDraft} style={actionGrayBtn}>
          ✉️ Invia email
        </button>
      </div>
    </div>
  );
}

const boxTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: 10,
};

const infoLine: React.CSSProperties = {
  color: "#334155",
  marginBottom: 6,
  lineHeight: 1.5,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 20,
  marginBottom: 12,
  marginTop: 0,
  color: "#0f172a",
};

const summaryRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  padding: "8px 0",
  borderBottom: "1px solid #e5e7eb",
  color: "#0f172a",
};

const pillBase: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
};

const pillGreen: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
};

const pillGray: React.CSSProperties = {
  background: "#e5e7eb",
  color: "#374151",
};

const actionBlueBtn: React.CSSProperties = {
  background: "#2d7ef7",
  color: "white",
  border: "none",
  padding: "12px 24px",
  fontSize: 15,
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const actionGreenBtn: React.CSSProperties = {
  background: "#1e9c57",
  color: "white",
  border: "none",
  padding: "12px 24px",
  fontSize: 15,
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const actionGrayBtn: React.CSSProperties = {
  background: "#475569",
  color: "white",
  border: "none",
  padding: "12px 24px",
  fontSize: 15,
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};