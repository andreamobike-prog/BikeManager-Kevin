"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Printer, Download, Mail, Archive } from "lucide-react";

type Customer = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
};

type Bike = {
  brand?: string | null;
  model?: string | null;
  serial?: string | null;
  serial_number?: string | null;
  color?: string | null;
};

type WorkOrder = {
  id: string;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  not_invoiced?: boolean | null;
  archived?: boolean | null;
  archived_at?: string | null;
  customers?: Customer | null;
  bikes?: Bike[] | null;
};

type Product = {
  id: string;
  title?: string | null;
  ean?: string | null;
  price_b2c?: number | null;
  fatturabile?: boolean | null;
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
  work_order_id: string;
  title: string;
  hours?: number | null;
  notes?: string | null;
  custom_price?: number | null;
  service_date?: string | null;
  billable?: boolean | null;
};

type ComputedPart = Part & {
  productTitle: string;
  productEan: string;
  appliedPrice: number;
  rowTotal: number;
  fatturabile: boolean;
};

type ComputedService = {
  id: string;
  title: string;
  hours?: number | null;
  service_date?: string | null;
  linePrice: number;
  modified: boolean;
  billable?: boolean;
};

type ToastType = "success" | "error" | "info";

const MINUTES_PER_HOUR = 60;

function hoursToMinutes(hours: number | null | undefined) {
  return Math.max(0, Math.round(Number(hours ?? 0) * MINUTES_PER_HOUR));
}

function formatMinutesLabel(hours: number | null | undefined) {
  const totalMinutes = hoursToMinutes(hours);

  if (totalMinutes <= 0) {
    return "0 min";
  }

  const wholeHours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const remainingMinutes = totalMinutes % MINUTES_PER_HOUR;

  if (wholeHours > 0 && remainingMinutes > 0) {
    return `${wholeHours} h ${remainingMinutes} min`;
  }

  if (wholeHours > 0) {
    return `${wholeHours} h`;
  }

  return `${totalMinutes} min`;
}

export default function WorkOrderReport() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [notInvoiced, setNotInvoiced] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [toast, setToast] = useState<{
    type: ToastType;
    message: string;
  } | null>(null);

  const hourlyRate = 35;

  const loadData = useCallback(async () => {
    setLoading(true);

    const [
      { data: orderData, error: orderError },
      { data: productData, error: productError },
      { data: partsData, error: partsError },
      { data: servicesData, error: servicesError },
    ] = await Promise.all([
      supabase
        .from("work_orders")
        .select(`*, customers(*), bikes(*)`)
        .eq("id", id)
        .single(),
      supabase.from("products").select("id,title,ean,price_b2c,fatturabile"),
      supabase.from("work_order_parts").select("*").eq("work_order_id", id),
      supabase
        .from("work_order_services")
        .select("*")
        .eq("work_order_id", id)
        .order("service_date", { ascending: true }),
    ]);

    if (orderError) {
      console.error(orderError);
      setToast({
        type: "error",
        message: `Errore caricamento scheda: ${orderError.message}`,
      });
    }

    if (productError) {
      console.error(productError);
      setToast({
        type: "error",
        message: `Errore caricamento prodotti: ${productError.message}`,
      });
    }

    if (partsError) {
      console.error(partsError);
      setToast({
        type: "error",
        message: `Errore caricamento ricambi: ${partsError.message}`,
      });
    }

    if (servicesError) {
      console.error(servicesError);
      setToast({
        type: "error",
        message: `Errore caricamento servizi: ${servicesError.message}`,
      });
    }

    const workOrder = (orderData as WorkOrder) || null;
    setOrder(workOrder);
    setProducts((productData as Product[]) || []);
    setParts((partsData as Part[]) || []);
    setServices((servicesData as Service[]) || []);

    if (workOrder) {
      setInvoiceNumber(workOrder.invoice_number || "");
      setInvoiceDate(workOrder.invoice_date || "");
      setNotInvoiced(Boolean(workOrder.not_invoiced));
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (id) {
      const timer = window.setTimeout(() => {
        void loadData();
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [id, loadData]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

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
      const appliedPrice = p.custom_price ?? (p.price_snapshot ?? product?.price_b2c ?? 0);

      return {
        ...p,
        productTitle: product?.title || "-",
        productEan: product?.ean || "-",
        appliedPrice,
        rowTotal: appliedPrice * p.quantity,
        fatturabile: Boolean(product?.fatturabile ?? true),
      };
    });
  }, [parts, productsMap]);

  const servicesComputed: ComputedService[] = useMemo(() => {
    return services.map((s) => {
      const hours = Number(s.hours || 0);
      const linePrice = Number(s.custom_price ?? hours * hourlyRate);
      const modified =
        s.custom_price !== null && s.custom_price !== undefined;

      return {
        ...s,
        billable: Boolean(s.billable ?? true),
        linePrice,
        modified,
      };
    });
  }, [services, hourlyRate]);

  const partsTotal = partsComputed.reduce((acc, p) => acc + p.rowTotal, 0);
  const serviceTotal = servicesComputed.reduce(
    (acc, s) => acc + s.linePrice,
    0
  );
  const total = partsTotal + serviceTotal;

  const firstBike = order?.bikes?.[0] ?? null;
  const bikeName = `${firstBike?.brand || ""} ${firstBike?.model || ""}`.trim();

  const nonBillableParts = useMemo(() => {
    return partsComputed.filter((p) => !p.fatturabile || !p.billable);
  }, [partsComputed]);

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

  async function downloadPDF() {
    const element = document.getElementById("report");
    if (!element) return;

    const buttons = element.querySelector(".print-buttons") as HTMLElement | null;
    const previousDisplay = buttons?.style.display ?? "";

    if (buttons) {
      buttons.style.display = "none";
    }

    try {
      const { default: html2pdf } = await import("html2pdf.js");

      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `report-${order?.id || "workorder"}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
        },
        jsPDF: {
          unit: "mm" as const,
          format: "a4" as const,
          orientation: "portrait" as const,
        },
        pagebreak: {
          mode: ["css", "legacy"],
          avoid: [
            ".report-box",
            ".report-block",
            ".report-summary-box",
            ".report-total-box",
            ".report-signatures",
          ],
        },
      };

      await html2pdf().set(opt).from(element).save();
    } finally {
      if (buttons) {
        buttons.style.display = previousDisplay;
      }
    }
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
      `Gestionale Kevin`,
    ].join("\n");

    const mailto = `mailto:${encodeURIComponent(
      recipient
    )}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
  }

  async function archiveWorkOrder() {
    if (!order) return;

    setArchiving(true);

    const archivePayload = {
      archived: true,
      archived_at: new Date().toISOString(),
      invoice_number: invoiceNumber.trim() || null,
      invoice_date: invoiceDate || null,
      status: "closed",
    };

    const { error: archiveError } = await supabase
      .from("work_orders")
      .update(archivePayload)
      .eq("id", id);

    if (archiveError) {
      console.error(archiveError);
      setToast({
        type: "error",
        message: `Errore archiviazione: ${archiveError.message}`,
      });
      setArchiving(false);
      return;
    }

    if (nonBillableParts.length > 0) {
      const rows = nonBillableParts.map((p) => ({
        work_order_id: id,
        product_id: p.product_id,
        inventory_movement_id: null,
        description: p.productTitle,
        quantity: p.quantity,
        unit_value: p.appliedPrice,
        total_value: p.rowTotal,
        handled: false,
        notes: p.fatturabile
          ? "Ricambio non fatturato per flag billable della riga"
          : "Ricambio non fatturabile da prodotto",
      }));

      const { error: insertError } = await supabase
        .from("non_billable_work_order_items")
        .insert(rows);

      if (insertError) {
        console.error(insertError);
        setToast({
          type: "error",
          message: `Scheda archiviata ma errore salvataggio ricambi non fatturabili: ${insertError.message}`,
        });
        setArchiving(false);
        return;
      }
    }

    setOrder((prev) =>
      prev
        ? {
          ...prev,
          ...archivePayload,
        }
        : prev
    );

    setShowArchiveModal(false);
    setArchiving(false);

    setToast({
      type: "success",
      message: "Scheda archiviata correttamente.",
    });

    setTimeout(() => {
      router.push("/workorders/archive");
    }, 800);
  }

  if (!order || loading) {
    return <div className="report-loading">Caricamento...</div>;
  }

  return (
    <div id="report" className="report-container">

      {toast && (
        <div
          className={`report-toast ${toast.type === "success"
            ? "report-toast--success"
            : toast.type === "error"
              ? "report-toast--error"
              : "report-toast--info"
            }`}
        >
          {toast.message}
        </div>
      )}

      {showArchiveModal && (
        <div className="report-modal-overlay">
          <div className="report-modal-card">
            <div className="report-modal-header">
              <div>
                <div className="report-modal-eyebrow">Chiusura amministrativa</div>
                <h2 className="report-modal-title">Fattura / Archivia scheda</h2>
                <p className="report-modal-subtitle">
                  Inserisci i dati fattura oppure marca la pratica come non fatturata.
                </p>
              </div>

              <button
                onClick={() => setShowArchiveModal(false)}
                className="report-modal-close"
                disabled={archiving}
              >
                ✕
              </button>
            </div>

            <div className="report-modal-body">
              <label className="report-field-label">Numero fattura</label>
              <input
                className={`report-input ${notInvoiced ? "report-input--disabled" : ""}`}
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                disabled={notInvoiced || archiving}
                placeholder="Es. 124/2026"
              />

              <label className="report-field-label">Data fattura</label>
              <input
                type="date"
                className={`report-input ${notInvoiced ? "report-input--disabled" : ""}`}
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                disabled={notInvoiced || archiving}
              />

            </div>

            <div className="report-modal-footer">
              <button
                className="report-secondary-btn"
                onClick={() => setShowArchiveModal(false)}
                disabled={archiving}
              >
                Annulla
              </button>

              <button
                className="report-primary-btn"
                onClick={archiveWorkOrder}
                disabled={archiving}
              >
                {archiving ? "Archiviazione..." : "Conferma e archivia"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="report-topbar">
        <div>
          <img src="/kc-logo.png" alt="KC" className="report-logo" />
        </div>

        <div className="report-topbar-meta">
          <h1 className="report-title">Scheda lavoro</h1>
          <div className="report-meta-line">ID lavoro: {order.id}</div>
          <div className="report-meta-line">
            Data report: {formatDate(new Date().toISOString())}
          </div>
          <div className="report-status-row">
            <span
              className={`report-pill ${order.archived ? "report-pill--gray" : "report-pill--green"
                }`}
            >
              {order.archived ? "Archiviata" : "Chiusa / Da amministrare"}
            </span>
          </div>
        </div>
      </div>

      <div className="report-grid">
        <div className="report-box report-box--soft">
          <div className="report-box-title">Cliente</div>
          <div className="report-info-line">
            <strong>Nome:</strong> {order.customers?.name || "-"}
          </div>
          <div className="report-info-line">
            <strong>Telefono:</strong> {order.customers?.phone || "-"}
          </div>
          <div className="report-info-line">
            <strong>Email:</strong> {order.customers?.email || "-"}
          </div>
        </div>

        <div className="report-box report-box--soft">
          <div className="report-box-title">Bici</div>
          <div className="report-info-line">
            <strong>Modello:</strong> {firstBike?.brand || "-"}{" "}
            {firstBike?.model || ""}
          </div>
          <div className="report-info-line">
            <strong>Telaio:</strong> {firstBike?.serial_number || firstBike?.serial || "-"}
          </div>
          <div className="report-info-line">
            <strong>Colore:</strong> {firstBike?.color || "-"}
          </div>
        </div>
      </div>

      <div className="report-block">
        <div className="report-box-title">Note scheda</div>
        <div className="report-text">{order.notes || "Nessuna nota inserita."}</div>
      </div>

      <div className="report-block report-block--muted">
        <div className="report-box-title">Dati amministrativi</div>
        <div className="report-info-line">
          <strong>Numero fattura:</strong> {order.invoice_number || "-"}
        </div>
        <div className="report-info-line">
          <strong>Data fattura:</strong> {formatDate(order.invoice_date)}
        </div>
        <div className="report-info-line">
          <strong>Non fatturato:</strong> {order.not_invoiced ? "Sì" : "No"}
        </div>
      </div>

      <h3 className="report-section-title">Ricambi utilizzati</h3>

      <table className="report-table">
        <thead>
          <tr>
            <th>Prodotto</th>
            <th>Q.tà</th>
            <th>Prezzo unitario</th>
            <th>Totale riga</th>
            <th>Indicatore interno</th>
          </tr>
        </thead>

        <tbody>
          {partsComputed.length === 0 ? (
            <tr>
              <td colSpan={5} className="report-table-empty">
                Nessun ricambio inserito.
              </td>
            </tr>
          ) : (
            partsComputed.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="report-product-title">{p.productTitle}</div>
                  <div className="report-product-meta">EAN: {p.productEan}</div>
                </td>

                <td>{p.quantity}</td>

                <td>
                  {formatCurrency(p.appliedPrice)}
                </td>

                <td>
                  {p.fatturabile && p.billable ? formatCurrency(p.rowTotal) : "-"}
                </td>

                <td className="report-cell-center">
                  {p.fatturabile && p.billable ? (
                    <span className="report-pill report-pill--green">
                      Fatturabile
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <h3 className="report-section-title">Interventi officina</h3>

      <table className="report-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Intervento</th>
            <th>Minuti</th>
            <th>Prezzo</th>
            <th>Totale fatturabile</th>
            <th>Indicatore interno</th>
          </tr>
        </thead>

        <tbody>
          {servicesComputed.length === 0 ? (
            <tr>
              <td colSpan={6} className="report-table-empty">
                Nessun intervento inserito.
              </td>
            </tr>
          ) : (
            servicesComputed.map((s) => (
              <tr key={s.id}>
                <td>{formatDate(s.service_date)}</td>
                <td>{s.title}</td>
                <td>{formatMinutesLabel(s.hours)}</td>
                <td>{formatCurrency(s.linePrice)}</td>
                <td>{formatCurrency(s.linePrice)}</td>
                <td className="report-cell-center">
                  {Boolean(s.billable ?? true) ? (
                    <span className="report-pill report-pill--green">
                      Fatturabile
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="report-summary">
        <div className="report-summary-box">
          <div className="report-box-title">Riepilogo report</div>

          <div className="report-summary-row">
            <span>Ricambi</span>
            <strong>
              {partsComputed.some((p) => p.fatturabile && p.billable)
                ? formatCurrency(
                  partsComputed.reduce((acc, p) => {
                    return p.fatturabile && p.billable
                      ? acc + Number(p.rowTotal || 0)
                      : acc;
                  }, 0)
                )
                : "-"}
            </strong>
          </div>

          <div className="report-summary-row">
            <span>Manodopera</span>
            <strong>
              {servicesComputed.some((s) => Boolean(s.billable ?? true))
                ? formatCurrency(
                  servicesComputed.reduce((acc, s) => {
                    return Boolean(s.billable ?? true)
                      ? acc + Number(s.linePrice || 0)
                      : acc;
                  }, 0)
                )
                : "-"}
            </strong>
          </div>

          <div className="report-summary-row">
            <span>Ricambi non fatturabili</span>
            <strong>-</strong>
          </div>
        </div>

        <div className="report-total-box">
          <div className="report-total-label">Totale fatturabile</div>
          <div className="report-total-value">
            {formatCurrency(
              partsComputed.reduce((acc, p) => {
                return p.fatturabile && p.billable
                  ? acc + Number(p.rowTotal || 0)
                  : acc;
              }, 0) +
              servicesComputed.reduce((acc, s) => {
                return Boolean(s.billable ?? true)
                  ? acc + Number(s.linePrice || 0)
                  : acc;
              }, 0)
            )}
          </div>
        </div>
      </div>

      <div className="report-signatures">
        <div className="report-signature-col">
          <p className="report-signature-label">Firma cliente</p>
          <div className="report-signature-line" />
        </div>

        <div className="report-signature-col">
          <p className="report-signature-label">Firma officina</p>
          <div className="report-signature-line" />
        </div>
      </div>

      <div className="print-buttons report-actions">
        <div className="report-actions-left">
          <button
            className="report-action-btn report-action-btn--close"
            onClick={() => router.push(`/workorders/${order.id}`)}
          >
            <span>Chiudi</span>
          </button>
        </div>

        <div className="report-actions-right">
          <button
            className="report-action-btn report-action-btn--print"
            onClick={() => window.print()}
          >
            <Printer size={16} strokeWidth={2.2} />
            <span>Stampa</span>
          </button>

          <button
            className="report-action-btn report-action-btn--download"
            onClick={downloadPDF}
          >
            <Download size={16} strokeWidth={2.2} />
            <span>Scarica PDF</span>
          </button>

          <button
            className="report-action-btn report-action-btn--email"
            onClick={openEmailDraft}
          >
            <Mail size={16} strokeWidth={2.2} />
            <span>Invia email</span>
          </button>

          {!order.archived && (
            <button
              className="report-action-btn report-action-btn--archive"
              onClick={() => setShowArchiveModal(true)}
            >
              <Archive size={16} strokeWidth={2.2} />
              <span>Fattura / Archivia</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
