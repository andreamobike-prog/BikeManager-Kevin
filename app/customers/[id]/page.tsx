"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useParams, useRouter } from "next/navigation";

type Customer = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at?: string | null;
};

type Bike = {
  id: string;
  customer_id: string;
  brand: string | null;
  model: string | null;
  serial: string | null;
  color: string | null;
  created_at?: string | null;
};

type WorkOrder = {
  id: string;
  created_at: string;
  status: string;
  notes: string | null;
  bikes: {
    brand: string | null;
    model: string | null;
  }[];
};

type ToastType = "success" | "error" | "info";

export default function CustomerDetail() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showBikeModal, setShowBikeModal] = useState(false);
  const [showAddBikeModal, setShowAddBikeModal] = useState(false);

  const [selectedBike, setSelectedBike] = useState<Bike | null>(null);
  const [deleteBikeId, setDeleteBikeId] = useState<string | null>(null);

  const [savingCustomer, setSavingCustomer] = useState(false);
  const [savingBike, setSavingBike] = useState(false);
  const [deletingBike, setDeletingBike] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  const [customerForm, setCustomerForm] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
  });

  const [bikeForm, setBikeForm] = useState({
    brand: "",
    model: "",
    serial: "",
    color: "",
  });

  useEffect(() => {
    loadAll();
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadCustomer(), loadBikes(), loadOrders()]);
    setLoading(false);
  }

  async function loadCustomer() {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error(error);
      setToast({
        message: `Errore caricamento cliente: ${error.message}`,
        type: "error",
      });
      return;
    }

    if (data) {
      setCustomer(data as Customer);
      setCustomerForm({
        name: data.name || "",
        phone: data.phone || "",
        email: data.email || "",
        notes: data.notes || "",
      });
    }
  }

  async function loadBikes() {
    const { data, error } = await supabase
      .from("bikes")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setToast({
        message: `Errore caricamento bici: ${error.message}`,
        type: "error",
      });
      return;
    }

    setBikes((data as Bike[]) || []);
  }

  async function loadOrders() {
    const { data, error } = await supabase
      .from("work_orders")
      .select(
        `
        id,
        created_at,
        status,
        notes,
        bikes(brand,model)
      `
      )
      .eq("customer_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setToast({
        message: `Errore caricamento schede officina: ${error.message}`,
        type: "error",
      });
      return;
    }

    setOrders((data as WorkOrder[]) || []);
  }

  function resetBikeForm() {
    setBikeForm({
      brand: "",
      model: "",
      serial: "",
      color: "",
    });
  }

  async function updateCustomer() {
    if (!customerForm.name.trim()) {
      setToast({
        message: "Il nome cliente è obbligatorio.",
        type: "error",
      });
      return;
    }

    setSavingCustomer(true);

    const { error } = await supabase
      .from("customers")
      .update({
        name: customerForm.name.trim(),
        phone: customerForm.phone.trim() || null,
        email: customerForm.email.trim() || null,
        notes: customerForm.notes.trim() || null,
      })
      .eq("id", id);

    if (error) {
      setToast({
        message: "Errore aggiornamento cliente.",
        type: "error",
      });
      console.error(error);
      setSavingCustomer(false);
      return;
    }

    setShowCustomerModal(false);
    await loadCustomer();
    setSavingCustomer(false);

    setToast({
      message: "Cliente aggiornato correttamente.",
      type: "success",
    });
  }

  async function createBike() {
    if (!bikeForm.brand.trim()) {
      setToast({
        message: "Inserisci la marca della bici.",
        type: "error",
      });
      return;
    }

    if (!bikeForm.model.trim()) {
      setToast({
        message: "Inserisci il modello della bici.",
        type: "error",
      });
      return;
    }

    setSavingBike(true);

    const { error } = await supabase.from("bikes").insert({
      customer_id: id,
      brand: bikeForm.brand.trim(),
      model: bikeForm.model.trim(),
      serial: bikeForm.serial.trim() || null,
      color: bikeForm.color.trim() || null,
    });

    if (error) {
      setToast({
        message: "Errore creazione bici.",
        type: "error",
      });
      setSavingBike(false);
      return;
    }

    resetBikeForm();
    setShowAddBikeModal(false);
    await loadBikes();
    setSavingBike(false);

    setToast({
      message: "Bici aggiunta correttamente.",
      type: "success",
    });
  }

  async function updateBike() {
    if (!selectedBike) return;

    if (!bikeForm.brand.trim()) {
      setToast({
        message: "Inserisci la marca della bici.",
        type: "error",
      });
      return;
    }

    if (!bikeForm.model.trim()) {
      setToast({
        message: "Inserisci il modello della bici.",
        type: "error",
      });
      return;
    }

    setSavingBike(true);

    const { error } = await supabase
      .from("bikes")
      .update({
        brand: bikeForm.brand.trim(),
        model: bikeForm.model.trim(),
        serial: bikeForm.serial.trim() || null,
        color: bikeForm.color.trim() || null,
      })
      .eq("id", selectedBike.id);

    if (error) {
      setToast({
        message: "Errore modifica bici.",
        type: "error",
      });
      setSavingBike(false);
      return;
    }

    setShowBikeModal(false);
    await loadBikes();
    setSavingBike(false);

    setToast({
      message: "Bici aggiornata correttamente.",
      type: "success",
    });
  }

  async function deleteBike() {
    if (!deleteBikeId) return;

    setDeletingBike(true);

    const { error } = await supabase.from("bikes").delete().eq("id", deleteBikeId);

    if (error) {
      setToast({
        message: "Errore eliminazione bici.",
        type: "error",
      });
      setDeletingBike(false);
      return;
    }

    setDeleteBikeId(null);
    await loadBikes();
    setDeletingBike(false);

    setToast({
      message: "Bici eliminata correttamente.",
      type: "success",
    });
  }

  const totalOrders = useMemo(() => orders.length, [orders]);
  const totalBikes = useMemo(() => bikes.length, [bikes]);
  const openOrders = useMemo(
    () => orders.filter((o) => o.status === "open" || o.status === "working").length,
    [orders]
  );

  if (loading) {
    return <div style={{ padding: 40 }}>Caricamento...</div>;
  }

  if (!customer) {
    return <div style={{ padding: 40 }}>Cliente non trovato.</div>;
  }

  return (
    <div style={page}>
      {toast && (
        <div
          style={{
            ...toastStyle,
            ...(toast.type === "success"
              ? toastSuccess
              : toast.type === "error"
              ? toastError
              : toastInfo),
          }}
        >
          {toast.message}
        </div>
      )}

      <div style={topBar}>
        <button onClick={() => router.push("/customers")} style={secondaryBtn}>
          ← Torna ai clienti
        </button>
      </div>

      <div style={customerHeader}>
        <div style={customerLeft}>
          <div style={avatar}>
            {(customer.name || "?").charAt(0).toUpperCase()}
          </div>

          <div>
            <div style={customerName}>{customer.name}</div>
            <div style={customerMeta}>📞 {customer.phone || "-"}</div>
            <div style={customerMeta}>✉️ {customer.email || "-"}</div>
          </div>
        </div>

        <button onClick={() => setShowCustomerModal(true)} style={blueBtn}>
          Modifica cliente
        </button>
      </div>

      <div style={statsGrid}>
        <StatCard label="Bici registrate" value={String(totalBikes)} />
        <StatCard label="Schede officina" value={String(totalOrders)} />
        <StatCard label="Schede attive" value={String(openOrders)} />
      </div>

      <div style={notesCard}>
        <div style={sectionMiniTitle}>Note cliente</div>
        <div style={notesText}>{customer.notes || "Nessuna nota disponibile."}</div>
      </div>

      <div style={sectionHeader}>
        <div>
          <h2 style={sectionTitle}>Bici cliente</h2>
          <p style={sectionSubtitle}>
            Gestisci le bici associate al cliente.
          </p>
        </div>

        <button
          onClick={() => {
            resetBikeForm();
            setShowAddBikeModal(true);
          }}
          style={greenBtn}
        >
          + Aggiungi bici
        </button>
      </div>

      {bikes.length === 0 ? (
        <div style={emptyBox}>Nessuna bici associata a questo cliente.</div>
      ) : (
        <div style={bikeGrid}>
          {bikes.map((bike) => (
            <div key={bike.id} style={bikeCard}>
              <div style={bikeBrand}>
                🚲 {bike.brand} {bike.model}
              </div>

              <div style={bikeInfoRow}>
                <span style={bikeLabel}>Telaio</span>
                <span style={bikeValue}>{bike.serial || "-"}</span>
              </div>

              <div style={bikeInfoRow}>
                <span style={bikeLabel}>Colore</span>
                <span style={bikeValue}>{bike.color || "-"}</span>
              </div>

              <div style={bikeActions}>
                <button
                  onClick={() => {
                    setSelectedBike(bike);
                    setBikeForm({
                      brand: bike.brand || "",
                      model: bike.model || "",
                      serial: bike.serial || "",
                      color: bike.color || "",
                    });
                    setShowBikeModal(true);
                  }}
                  style={grayBtn}
                >
                  Modifica
                </button>

                <button
                  onClick={() => setDeleteBikeId(bike.id)}
                  style={redBtn}
                >
                  Elimina
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 50 }}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>Schede officina</h2>
            <p style={sectionSubtitle}>
              Storico delle lavorazioni collegate al cliente.
            </p>
          </div>
        </div>

        {orders.length === 0 ? (
          <div style={emptyBox}>Nessuna scheda officina collegata.</div>
        ) : (
          <div style={ordersBox}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Data</th>
                  <th style={th}>Bici</th>
                  <th style={th}>Stato</th>
                  <th style={th}>Azione</th>
                </tr>
              </thead>

              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} style={row}>
                    <td style={td}>
                      {order.created_at
                        ? new Date(order.created_at).toLocaleDateString("it-IT")
                        : "-"}
                    </td>

                    <td style={td}>
                     {order.bikes?.[0]?.brand || "-"} {order.bikes?.[0]?.model || ""}
                    </td>

                    <td style={td}>
                      <span style={statusBadge(order.status)}>
                        {order.status}
                      </span>
                    </td>

                    <td style={td}>
                      <button
                        onClick={() => {
                          if (order.status === "closed") {
                            router.push(`/workorders/${order.id}/report`);
                          } else {
                            router.push(`/workorders/${order.id}`);
                          }
                        }}
                        style={blueBtnSmall}
                      >
                        Apri
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCustomerModal && (
        <ModalShell
          title="Modifica cliente"
          subtitle="Aggiorna i dati anagrafici e le note del cliente."
          icon="👤"
        >
          <FormField label="Nome cliente *">
            <input
              placeholder="Nome"
              value={customerForm.name}
              onChange={(e) =>
                setCustomerForm({ ...customerForm, name: e.target.value })
              }
              style={inputPremium}
            />
          </FormField>

          <FormField label="Telefono">
            <input
              placeholder="Telefono"
              value={customerForm.phone}
              onChange={(e) =>
                setCustomerForm({ ...customerForm, phone: e.target.value })
              }
              style={inputPremium}
            />
          </FormField>

          <FormField label="Email">
            <input
              placeholder="Email"
              value={customerForm.email}
              onChange={(e) =>
                setCustomerForm({ ...customerForm, email: e.target.value })
              }
              style={inputPremium}
            />
          </FormField>

          <FormField label="Note">
            <textarea
              placeholder="Aggiungi note utili sul cliente..."
              value={customerForm.notes}
              onChange={(e) =>
                setCustomerForm({ ...customerForm, notes: e.target.value })
              }
              style={textareaPremium}
            />
          </FormField>

          <div style={modalFooter}>
            <button
              onClick={() => setShowCustomerModal(false)}
              style={secondaryBtnModal}
              disabled={savingCustomer}
            >
              Annulla
            </button>

            <button
              onClick={updateCustomer}
              style={primaryBtnModal}
              disabled={savingCustomer}
            >
              {savingCustomer ? "Salvataggio..." : "Salva modifiche"}
            </button>
          </div>
        </ModalShell>
      )}

      {showAddBikeModal && (
        <ModalShell
          title="Aggiungi bici"
          subtitle="Registra una nuova bici associata a questo cliente."
          icon="🚲"
        >
          <FormField label="Marca *">
            <input
              placeholder="Marca"
              value={bikeForm.brand}
              onChange={(e) => setBikeForm({ ...bikeForm, brand: e.target.value })}
              style={inputPremium}
            />
          </FormField>

          <FormField label="Modello *">
            <input
              placeholder="Modello"
              value={bikeForm.model}
              onChange={(e) => setBikeForm({ ...bikeForm, model: e.target.value })}
              style={inputPremium}
            />
          </FormField>

          <FormField label="Numero telaio">
            <input
              placeholder="Telaio"
              value={bikeForm.serial}
              onChange={(e) => setBikeForm({ ...bikeForm, serial: e.target.value })}
              style={inputPremium}
            />
          </FormField>

          <FormField label="Colore">
            <input
              placeholder="Colore"
              value={bikeForm.color}
              onChange={(e) => setBikeForm({ ...bikeForm, color: e.target.value })}
              style={inputPremium}
            />
          </FormField>

          <div style={modalFooter}>
            <button
              onClick={() => setShowAddBikeModal(false)}
              style={secondaryBtnModal}
              disabled={savingBike}
            >
              Annulla
            </button>

            <button
              onClick={createBike}
              style={successBtnModal}
              disabled={savingBike}
            >
              {savingBike ? "Salvataggio..." : "Salva bici"}
            </button>
          </div>
        </ModalShell>
      )}

      {showBikeModal && (
        <ModalShell
          title="Modifica bici"
          subtitle="Aggiorna i dati della bici del cliente."
          icon="🛠️"
        >
          <FormField label="Marca *">
            <input
              value={bikeForm.brand}
              onChange={(e) => setBikeForm({ ...bikeForm, brand: e.target.value })}
              style={inputPremium}
              placeholder="Marca"
            />
          </FormField>

          <FormField label="Modello *">
            <input
              value={bikeForm.model}
              onChange={(e) => setBikeForm({ ...bikeForm, model: e.target.value })}
              style={inputPremium}
              placeholder="Modello"
            />
          </FormField>

          <FormField label="Numero telaio">
            <input
              value={bikeForm.serial}
              onChange={(e) => setBikeForm({ ...bikeForm, serial: e.target.value })}
              style={inputPremium}
              placeholder="Telaio"
            />
          </FormField>

          <FormField label="Colore">
            <input
              value={bikeForm.color}
              onChange={(e) => setBikeForm({ ...bikeForm, color: e.target.value })}
              style={inputPremium}
              placeholder="Colore"
            />
          </FormField>

          <div style={modalFooter}>
            <button
              onClick={() => setShowBikeModal(false)}
              style={secondaryBtnModal}
              disabled={savingBike}
            >
              Annulla
            </button>

            <button
              onClick={updateBike}
              style={primaryBtnModal}
              disabled={savingBike}
            >
              {savingBike ? "Salvataggio..." : "Salva modifiche"}
            </button>
          </div>
        </ModalShell>
      )}

      {deleteBikeId && (
        <ModalShell
          title="Elimina bici"
          subtitle="Stai per rimuovere definitivamente questa bici dal cliente."
          icon="🗑️"
        >
          <div style={dangerBox}>
            Questa operazione non può essere annullata. Verifica di voler davvero
            eliminare la bici selezionata.
          </div>

          <div style={modalFooter}>
            <button
              onClick={() => setDeleteBikeId(null)}
              style={secondaryBtnModal}
              disabled={deletingBike}
            >
              Annulla
            </button>

            <button
              onClick={deleteBike}
              style={dangerBtnModal}
              disabled={deletingBike}
            >
              {deletingBike ? "Eliminazione..." : "Conferma eliminazione"}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={statCard}>
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
    </div>
  );
}

function ModalShell({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={overlay}>
      <div style={modalPremium}>
        <div style={modalTopBar}>
          <div style={modalIcon}>{icon || "✨"}</div>

          <div>
            <h2 style={modalPremiumTitle}>{title}</h2>
            {subtitle ? <p style={modalPremiumSubtitle}>{subtitle}</p> : null}
          </div>
        </div>

        <div style={modalContent}>{children}</div>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={fieldWrap}>
      <label style={fieldTitle}>{label}</label>
      {children}
    </div>
  );
}

/* STILI */

const page: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: 32,
  background: "#f8fafc",
  minHeight: "100vh",
};

const topBar: React.CSSProperties = {
  marginBottom: 18,
};

const customerHeader: React.CSSProperties = {
  background: "white",
  padding: 30,
  borderRadius: 22,
  boxShadow: "0 10px 30px rgba(0,0,0,0.07)",
  marginBottom: 24,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
  flexWrap: "wrap",
};

const customerLeft: React.CSSProperties = {
  display: "flex",
  gap: 16,
  alignItems: "center",
};

const avatar: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 18,
  background: "#dbeafe",
  color: "#1d4ed8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 26,
  fontWeight: 800,
  flexShrink: 0,
};

const customerName: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  color: "#0f172a",
};

const customerMeta: React.CSSProperties = {
  fontSize: 15,
  color: "#64748b",
  marginTop: 6,
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 16,
  marginBottom: 24,
};

const statCard: React.CSSProperties = {
  background: "white",
  borderRadius: 18,
  border: "1px solid #e2e8f0",
  padding: 18,
  boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
};

const statLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  marginBottom: 8,
};

const statValue: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: "#0f172a",
};

const notesCard: React.CSSProperties = {
  background: "white",
  borderRadius: 18,
  border: "1px solid #e2e8f0",
  padding: 20,
  marginBottom: 30,
};

const sectionMiniTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: 10,
};

const notesText: React.CSSProperties = {
  color: "#475569",
  lineHeight: 1.5,
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  flexWrap: "wrap",
  marginBottom: 20,
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
  color: "#0f172a",
};

const sectionSubtitle: React.CSSProperties = {
  marginTop: 6,
  color: "#64748b",
  fontSize: 14,
};

const bikeGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
  gap: 18,
};

const bikeCard: React.CSSProperties = {
  background: "white",
  padding: 20,
  borderRadius: 18,
  boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
  border: "1px solid #e5e7eb",
};

const bikeBrand: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 18,
  marginBottom: 10,
  color: "#0f172a",
};

const bikeInfoRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  marginTop: 8,
};

const bikeLabel: React.CSSProperties = {
  fontSize: 13,
  color: "#64748b",
};

const bikeValue: React.CSSProperties = {
  fontSize: 14,
  color: "#0f172a",
  fontWeight: 600,
  textAlign: "right",
};

const bikeActions: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 16,
};

const ordersBox: React.CSSProperties = {
  background: "white",
  borderRadius: 18,
  boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
  overflow: "hidden",
  border: "1px solid #e5e7eb",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const row: React.CSSProperties = {
  borderTop: "1px solid #eef2f7",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 14,
  fontSize: 13,
  color: "#64748b",
  background: "#f8fafc",
};

const td: React.CSSProperties = {
  padding: 14,
  color: "#0f172a",
};

const overlay: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(15,23,42,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 20,
  backdropFilter: "blur(4px)",
};

const modalPremium: React.CSSProperties = {
  background: "#ffffff",
  width: "100%",
  maxWidth: 560,
  borderRadius: 24,
  padding: 28,
  boxShadow: "0 30px 80px rgba(15,23,42,0.28)",
  border: "1px solid #e2e8f0",
};

const modalTopBar: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 22,
};

const modalIcon: React.CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: 16,
  background: "#dbeafe",
  color: "#1d4ed8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
  flexShrink: 0,
};

const modalPremiumTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
  fontWeight: 800,
  color: "#0f172a",
};

const modalPremiumSubtitle: React.CSSProperties = {
  margin: "8px 0 0 0",
  color: "#64748b",
  fontSize: 14,
  lineHeight: 1.5,
};

const modalContent: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const fieldWrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const fieldTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#334155",
};

const inputPremium: React.CSSProperties = {
  width: "100%",
  padding: "13px 14px",
  borderRadius: 14,
  border: "1px solid #dbe2ea",
  fontSize: 14,
  outline: "none",
  background: "#fff",
};

const textareaPremium: React.CSSProperties = {
  width: "100%",
  minHeight: 120,
  padding: "13px 14px",
  borderRadius: 14,
  border: "1px solid #dbe2ea",
  fontSize: 14,
  outline: "none",
  resize: "vertical",
  background: "#fff",
};

const modalFooter: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  marginTop: 8,
  flexWrap: "wrap",
};

const blueBtn: React.CSSProperties = {
  background: "#2563eb",
  color: "white",
  border: "none",
  padding: "10px 16px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const greenBtn: React.CSSProperties = {
  background: "#22c55e",
  color: "white",
  border: "none",
  padding: "10px 16px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const redBtn: React.CSSProperties = {
  background: "#ef4444",
  color: "white",
  border: "none",
  padding: "10px 16px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const grayBtn: React.CSSProperties = {
  background: "#e5e7eb",
  border: "none",
  padding: "10px 16px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryBtn: React.CSSProperties = {
  background: "#fff",
  color: "#0f172a",
  border: "1px solid #dbe2ea",
  padding: "10px 16px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 700,
};

const blueBtnSmall: React.CSSProperties = {
  background: "#2563eb",
  color: "white",
  border: "none",
  padding: "8px 12px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
};

const primaryBtnModal: React.CSSProperties = {
  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
  color: "#fff",
  border: "none",
  padding: "12px 18px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 800,
  boxShadow: "0 12px 24px rgba(37,99,235,0.2)",
};

const successBtnModal: React.CSSProperties = {
  background: "linear-gradient(135deg,#22c55e,#16a34a)",
  color: "#fff",
  border: "none",
  padding: "12px 18px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 800,
  boxShadow: "0 12px 24px rgba(34,197,94,0.2)",
};

const dangerBtnModal: React.CSSProperties = {
  background: "linear-gradient(135deg,#ef4444,#dc2626)",
  color: "#fff",
  border: "none",
  padding: "12px 18px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 800,
  boxShadow: "0 12px 24px rgba(239,68,68,0.2)",
};

const secondaryBtnModal: React.CSSProperties = {
  background: "#f1f5f9",
  color: "#0f172a",
  border: "1px solid #dbe2ea",
  padding: "12px 18px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
};

const dangerBox: React.CSSProperties = {
  background: "#fff1f2",
  border: "1px solid #fecdd3",
  color: "#9f1239",
  padding: 16,
  borderRadius: 14,
  lineHeight: 1.5,
  fontSize: 14,
};

const emptyBox: React.CSSProperties = {
  background: "white",
  border: "1px dashed #cbd5e1",
  borderRadius: 18,
  padding: 28,
  textAlign: "center",
  color: "#64748b",
};

const toastStyle: React.CSSProperties = {
  position: "fixed",
  top: 24,
  right: 24,
  zIndex: 1100,
  padding: "14px 18px",
  borderRadius: 14,
  fontWeight: 700,
  boxShadow: "0 12px 30px rgba(15,23,42,0.16)",
};

const toastSuccess: React.CSSProperties = {
  background: "#ecfdf5",
  color: "#065f46",
  border: "1px solid #a7f3d0",
};

const toastError: React.CSSProperties = {
  background: "#fff1f2",
  color: "#9f1239",
  border: "1px solid #fecdd3",
};

const toastInfo: React.CSSProperties = {
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
};

function statusBadge(status: any): React.CSSProperties {
  if (status === "open") {
    return {
      background: "#e0f2fe",
      color: "#075985",
      padding: "5px 10px",
      borderRadius: 999,
      fontWeight: 700,
      fontSize: 12,
    };
  }

  if (status === "working") {
    return {
      background: "#fff7ed",
      color: "#c2410c",
      padding: "5px 10px",
      borderRadius: 999,
      fontWeight: 700,
      fontSize: 12,
    };
  }

  return {
    background: "#e5e7eb",
    color: "#374151",
    padding: "5px 10px",
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 12,
  };
}