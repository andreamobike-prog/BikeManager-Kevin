"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

type WorkOrderRow = {
  id: string;
  status: string | null;
  archived?: boolean | null;
  created_at: string | null;
  customers?: {
    name?: string | null;
  } | null;
  bikes?: {
    brand?: string | null;
    model?: string | null;
  } | null;
};

export default function WorkOrdersPage() {
  const [orders, setOrders] = useState<WorkOrderRow[]>([]);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    const { data, error } = await supabase
      .from("work_orders")
      .select(
        `
        id,
        status,
        archived,
        created_at,
        customers(name),
        bikes(brand,model)
      `
      )
      .eq("archived", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Errore caricamento schede:", error);
      setOrders([]);
      return;
    }

    setOrders((data as WorkOrderRow[]) || []);
  }

  async function updateStatus(id: string, newStatus: string) {
    setUpdatingId(id);

    const { error } = await supabase
      .from("work_orders")
      .update({
        status: newStatus,
      })
      .eq("id", id);

    if (error) {
      console.error("Errore aggiornamento stato:", error);
      setUpdatingId(null);
      return;
    }

    await loadOrders();
    setUpdatingId(null);
  }

  async function deleteOrder(id: string) {
    const ok = window.confirm("Eliminare scheda lavoro?");
    if (!ok) return;

    setDeletingId(id);

    const { error: partsError } = await supabase
      .from("work_order_parts")
      .delete()
      .eq("work_order_id", id);

    if (partsError) {
      console.error("Errore eliminazione ricambi:", partsError);
      setDeletingId(null);
      return;
    }

    const { error: servicesError } = await supabase
      .from("work_order_services")
      .delete()
      .eq("work_order_id", id);

    if (servicesError) {
      console.error("Errore eliminazione interventi:", servicesError);
      setDeletingId(null);
      return;
    }

    const { error: movementsError } = await supabase
      .from("inventory_movements")
      .delete()
      .eq("work_order_id", id);

    if (movementsError) {
      console.error("Errore eliminazione movimenti:", movementsError);
      setDeletingId(null);
      return;
    }

    const { error: nonBillableError } = await supabase
      .from("non_billable_work_order_items")
      .delete()
      .eq("work_order_id", id);

    if (nonBillableError) {
      console.error("Errore eliminazione ricambi da gestire:", nonBillableError);
      setDeletingId(null);
      return;
    }

    const { error: orderError } = await supabase
      .from("work_orders")
      .delete()
      .eq("id", id);

    if (orderError) {
      console.error("Errore eliminazione scheda:", orderError);
      setDeletingId(null);
      return;
    }

    await loadOrders();
    setDeletingId(null);
  }

  function onDragEnd(result: any) {
    if (!result.destination) return;

    const id = String(result.draggableId);
    const newStatus = String(result.destination.droppableId);

    if (!id || !newStatus) return;

    updateStatus(id, newStatus);
  }

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (!search.trim()) return true;

      const q = search.toLowerCase();

      return (
        (o.customers?.name || "").toLowerCase().includes(q) ||
        `${o.bikes?.brand || ""} ${o.bikes?.model || ""}`.toLowerCase().includes(q)
      );
    });
  }, [orders, search]);

  const open = filtered.filter((o) => o.status === "open");
  const working = filtered.filter((o) => o.status === "working");
  const closed = filtered.filter((o) => o.status === "closed");

  return (
    <div className="app-page-shell workorders-page-shell">
      <div className="page-stack">
        <div className="page-header workorders-header">
          <div className="page-header__left">
            <div className="apple-kicker">Officina</div>
            <h1 className="apple-page-title">Schede officina</h1>
            <p className="apple-page-subtitle">
              Gestisci i lavori dell&apos;officina tramite workflow drag &amp; drop.
            </p>
          </div>

          <div className="page-header__right workorders-header-actions">
            <Link href="/workorders/archive">
              <button className="btn-secondary workorders-archive-btn">Archivio</button>
            </Link>

            <Link href="/workorders/new">
              <button className="btn-primary workorders-new-btn">
                + Nuova scheda lavoro
              </button>
            </Link>
          </div>
        </div>

        <input
          className="apple-input workorders-search"
          placeholder="Cerca cliente o bici..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="workorders-stats-grid">
          <Stat title="Aperte" value={open.length} tone="blue" />
          <Stat title="In lavorazione" value={working.length} tone="orange" />
          <Stat title="Chiuse" value={closed.length} tone="green" />
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="workorders-board">
            <Column
              title="Aperte"
              status="open"
              orders={open}
              updateStatus={updateStatus}
              deleteOrder={deleteOrder}
              updatingId={updatingId}
              deletingId={deletingId}
            />
            <Column
              title="In lavorazione"
              status="working"
              orders={working}
              updateStatus={updateStatus}
              deleteOrder={deleteOrder}
              updatingId={updatingId}
              deletingId={deletingId}
            />
            <Column
              title="Chiuse"
              status="closed"
              orders={closed}
              updateStatus={updateStatus}
              deleteOrder={deleteOrder}
              updatingId={updatingId}
              deletingId={deletingId}
            />
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}

function Column({
  title,
  status,
  orders,
  updateStatus,
  deleteOrder,
  updatingId,
  deletingId,
}: {
  title: string;
  status: string;
  orders: WorkOrderRow[];
  updateStatus: (id: string, newStatus: string) => void;
  deleteOrder: (id: string) => void;
  updatingId: string | null;
  deletingId: string | null;
}) {
  return (
    <div className="workorders-column">
      <div className="workorders-column__header">
        <h3 className="workorders-column__title">{title}</h3>
        <span className="workorders-column__count">{orders.length}</span>
      </div>

      <Droppable droppableId={status}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="workorders-column__body"
          >
            {orders.map((o, index) => (
              <Draggable key={o.id} draggableId={String(o.id)} index={index}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                  >
                    <Card
                      order={o}
                      updateStatus={updateStatus}
                      deleteOrder={deleteOrder}
                      updatingId={updatingId}
                      deletingId={deletingId}
                    />
                  </div>
                )}
              </Draggable>
            ))}

            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

function Card({
  order,
  updateStatus,
  deleteOrder,
  updatingId,
  deletingId,
}: {
  order: WorkOrderRow;
  updateStatus: (id: string, newStatus: string) => void;
  deleteOrder: (id: string) => void;
  updatingId: string | null;
  deletingId: string | null;
}) {
  const isUpdating = updatingId === order.id;
  const isDeleting = deletingId === order.id;
  const isBusy = isUpdating || isDeleting;

  return (
    <div className="workorders-card">
      <div className="workorders-card__top">
        <div>
          <div className="workorders-card__client">
            {order.customers?.name || "Cliente senza nome"}
          </div>
          <div className="workorders-card__bike">
            🚲 {order.bikes?.brand || "-"} {order.bikes?.model || ""}
          </div>
        </div>

        <div className="workorders-card__date">
          {order.created_at
            ? new Date(order.created_at).toLocaleDateString("it-IT")
            : "-"}
        </div>
      </div>

      <div className="workorders-card__actions">
        {order.status === "open" && (
          <>
            <button
              onClick={() => deleteOrder(order.id)}
              className="workorders-action-btn workorders-action-btn--danger"
              disabled={isBusy}
            >
              {isDeleting ? "Elimino..." : "Elimina"}
            </button>

            <div className="workorders-card__actions-right">
              <button
                onClick={() => updateStatus(order.id, "working")}
                className="workorders-action-btn workorders-action-btn--primary"
                disabled={isBusy}
              >
                {isUpdating ? "Aggiornamento..." : "Prendi in carico"}
              </button>
            </div>
          </>
        )}

        {order.status === "working" && (
          <>
            <button
              onClick={() => deleteOrder(order.id)}
              className="workorders-action-btn workorders-action-btn--danger"
              disabled={isBusy}
            >
              {isDeleting ? "Elimino..." : "Elimina"}
            </button>

            <div className="workorders-card__actions-right">
              <Link href={`/workorders/${order.id}`}>
                <button
                  className="workorders-action-btn workorders-action-btn--success"
                  disabled={isBusy}
                >
                  Apri
                </button>
              </Link>

              <button
                onClick={() => updateStatus(order.id, "closed")}
                className="workorders-action-btn workorders-action-btn--primary"
                disabled={isBusy}
              >
                {isUpdating ? "Aggiornamento..." : "Chiudi"}
              </button>
            </div>
          </>
        )}

        {order.status === "closed" && (
          <div className="workorders-card__actions-right">
            <Link href={`/workorders/${order.id}/report`}>
              <button
                className="workorders-action-btn workorders-action-btn--primary"
                disabled={isBusy}
              >
                Apri report
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: "blue" | "orange" | "green";
}) {
  return (
    <div className="dashboard-metric-card workorders-metric-card">
      <div className={`dashboard-metric-value workorders-metric-value is-${tone}`}>
        {value}
      </div>
      <div className="dashboard-metric-label">{title}</div>
    </div>
  );
}