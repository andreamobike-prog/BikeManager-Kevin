"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type ArchiveOrder = {
  id: string;
  status: string | null;
  archived: boolean | null;
  created_at: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  not_invoiced?: boolean | null;
  customers?: {
    name?: string | null;
  } | null;
  bikes?: {
    brand?: string | null;
    model?: string | null;
  } | null;
};

type ToastType = "success" | "error" | "info";

export default function ArchivePage() {
  const [orders, setOrders] = useState<ArchiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [toast, setToast] = useState<{
    type: ToastType;
    message: string;
  } | null>(null);

  useEffect(() => {
    loadArchive();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadArchive() {
    setLoading(true);

    const { data, error } = await supabase
      .from("work_orders")
      .select(
        `
        id,
        status,
        archived,
        created_at,
        invoice_number,
        invoice_date,
        not_invoiced,
        customers(name),
        bikes(brand,model)
      `
      )
      .eq("archived", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Errore caricamento archivio:", error);
      setToast({
        type: "error",
        message: `Errore caricamento archivio: ${error.message}`,
      });
      setOrders([]);
      setLoading(false);
      return;
    }

    setOrders((data as ArchiveOrder[]) || []);
    setLoading(false);
  }

  async function restoreOrder(id: string) {
    const ok = window.confirm(
      "Ripristinare questa scheda? I ricambi presenti in 'da gestire' verranno rimossi e torneranno nel flusso normale della scheda lavoro."
    );

    if (!ok) return;

    setRestoringId(id);

    const { error: restoreError } = await supabase
      .from("work_orders")
      .update({
        archived: false,
        status: "open",
        invoice_number: null,
        invoice_date: null,
        not_invoiced: false,
      })
      .eq("id", id);

    if (restoreError) {
      console.error("Errore ripristino scheda:", restoreError);
      setToast({
        type: "error",
        message: `Errore ripristino scheda: ${restoreError.message}`,
      });
      setRestoringId(null);
      return;
    }

    const { error: cleanupError } = await supabase
      .from("non_billable_work_order_items")
      .delete()
      .eq("work_order_id", id);

    if (cleanupError) {
      console.error("Errore pulizia ricambi da gestire:", cleanupError);
      setToast({
        type: "error",
        message: `Scheda ripristinata, ma errore nella pulizia ricambi da gestire: ${cleanupError.message}`,
      });
      await loadArchive();
      setRestoringId(null);
      return;
    }

    setToast({
      type: "success",
      message: "Scheda ripristinata correttamente.",
    });

    await loadArchive();
    setRestoringId(null);
  }

  async function deleteOrder(id: string) {
    const ok = window.confirm(
      "Eliminare definitivamente questa scheda? Questa operazione non può essere annullata."
    );
    if (!ok) return;

    setDeletingId(id);

    const { error: nonBillableError } = await supabase
      .from("non_billable_work_order_items")
      .delete()
      .eq("work_order_id", id);

    if (nonBillableError) {
      console.error("Errore eliminazione non billable items:", nonBillableError);
      setToast({
        type: "error",
        message: `Errore eliminazione voci da gestire: ${nonBillableError.message}`,
      });
      setDeletingId(null);
      return;
    }

    const { error: partsError } = await supabase
      .from("work_order_parts")
      .delete()
      .eq("work_order_id", id);

    if (partsError) {
      console.error("Errore eliminazione parts:", partsError);
      setToast({
        type: "error",
        message: `Errore eliminazione ricambi scheda: ${partsError.message}`,
      });
      setDeletingId(null);
      return;
    }

    const { error: servicesError } = await supabase
      .from("work_order_services")
      .delete()
      .eq("work_order_id", id);

    if (servicesError) {
      console.error("Errore eliminazione services:", servicesError);
      setToast({
        type: "error",
        message: `Errore eliminazione interventi: ${servicesError.message}`,
      });
      setDeletingId(null);
      return;
    }

    const { error: movementsError } = await supabase
      .from("inventory_movements")
      .delete()
      .eq("work_order_id", id);

    if (movementsError) {
      console.error("Errore eliminazione movements:", movementsError);
      setToast({
        type: "error",
        message: `Errore eliminazione movimenti: ${movementsError.message}`,
      });
      setDeletingId(null);
      return;
    }

    const { error: orderError } = await supabase
      .from("work_orders")
      .delete()
      .eq("id", id);

    if (orderError) {
      console.error("Errore eliminazione work order:", orderError);
      setToast({
        type: "error",
        message: `Errore eliminazione scheda: ${orderError.message}`,
      });
      setDeletingId(null);
      return;
    }

    setToast({
      type: "success",
      message: "Scheda eliminata correttamente.",
    });

    await loadArchive();
    setDeletingId(null);
  }

  function formatDate(value: string | null | undefined) {
    if (!value) return "-";
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return orders;

    return orders.filter((o) => {
      const customer = o.customers?.name?.toLowerCase() || "";
      const bike = `${o.bikes?.brand || ""} ${o.bikes?.model || ""}`.toLowerCase();
      const invoiceNumber = (o.invoice_number || "").toLowerCase();

      return (
        customer.includes(q) ||
        bike.includes(q) ||
        invoiceNumber.includes(q)
      );
    });
  }, [orders, search]);

  return (
    <div className="archive-page">
      {toast && (
        <div
          className={`archive-toast ${toast.type === "success"
            ? "archive-toast--success"
            : toast.type === "error"
              ? "archive-toast--error"
              : "archive-toast--info"
            }`}
        >
          {toast.message}
        </div>
      )}

      <div className="archive-header">
        <div>
          <div className="archive-eyebrow">Storico amministrativo</div>
          <h1 className="archive-title">Archivio schede lavoro</h1>
          <p className="archive-subtitle">
            Qui trovi le schede archiviate, con fattura, stato amministrativo e accesso al report finale.
          </p>
        </div>

        <Link href="/workorders">
          <button className="archive-back-btn">← Torna alle schede</button>
        </Link>
      </div>

      <div className="archive-toolbar">
        <input
          className="archive-search-input"
          placeholder="Cerca cliente, bici o numero fattura..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="archive-stats-row">
        <div className="archive-stat-card">
          <div className="archive-stat-label">Schede archiviate</div>
          <div className="archive-stat-value">{filtered.length}</div>
        </div>

        <div className="archive-stat-card">
          <div className="archive-stat-label">Fatturate</div>
          <div className="archive-stat-value">
            {filtered.filter((o) => !o.not_invoiced).length}
          </div>
        </div>

        <div className="archive-stat-card">
          <div className="archive-stat-label">Non fatturate</div>
          <div className="archive-stat-value">
            {filtered.filter((o) => Boolean(o.not_invoiced)).length}
          </div>
        </div>
      </div>

      <div className="archive-card">
        {loading ? (
          <div className="archive-empty-state">Caricamento archivio...</div>
        ) : filtered.length === 0 ? (
          <div className="archive-empty-state">Nessuna scheda archiviata trovata.</div>
        ) : (
          <div className="archive-table-wrap">
            <table className="archive-table">
              <thead>
                <tr>
                  <th className="archive-th">Cliente</th>
                  <th className="archive-th">Bici</th>
                  <th className="archive-th">Data scheda</th>
                  <th className="archive-th">Fattura</th>
                  <th className="archive-th">Stato</th>
                  <th className="archive-th archive-th--actions"></th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id}>
                    <td className="archive-td">
                      <div className="archive-main-cell">{o.customers?.name || "-"}</div>
                      <div className="archive-sub-cell">ID: {o.id.slice(0, 8)}</div>
                    </td>

                    <td className="archive-td">
                      {o.bikes?.brand || "-"} {o.bikes?.model || ""}
                    </td>

                    <td className="archive-td">{formatDate(o.created_at)}</td>

                    <td className="archive-td">{o.invoice_number || "-"}</td>

                    <td className="archive-td">
                      {o.invoice_number && o.invoice_date ? (
                        <span className="archive-badge archive-badge--ok">Fatturato</span>
                      ) : null}
                    </td>

                    <td className="archive-td archive-td--actions">
                      <div className="archive-actions">
                        <Link href={`/workorders/${o.id}/report`}>
                          <button className="archive-workorders-btn archive-workorders-btn--report">
                            Apri report
                          </button>
                        </Link>

                        <button
                          className="archive-workorders-btn archive-workorders-btn--restore"
                          onClick={() => restoreOrder(o.id)}
                          disabled={restoringId === o.id}
                        >
                          {restoringId === o.id ? "Ripristino..." : "Ripristina"}
                        </button>

                        <button
                          className="archive-workorders-btn archive-workorders-btn--delete"
                          onClick={() => deleteOrder(o.id)}
                          disabled={deletingId === o.id}
                        >
                          {deletingId === o.id ? "Elimino..." : "Elimina"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}