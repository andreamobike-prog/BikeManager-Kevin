"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Printer, Wrench, ClipboardPenLine } from "lucide-react";

type WorkOrder = {
  id: string;
  customer_id?: string | null;
  bike_id?: string | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  customers?: {
    id?: string;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  bikes?: {
    id?: string;
    brand?: string | null;
    model?: string | null;
    serial?: string | null;
    serial_number?: string | null;
    color?: string | null;
  } | null;
};

type Product = {
  id: string;
  title?: string | null;
  ean?: string | null;
  price_b2c?: number | null;
  warehouse_qty?: number | null;
};

type Part = {
  id: string;
  work_order_id: string;
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
  billable?: boolean;
  service_date?: string | null;
};

type Toast = {
  type: "success" | "error" | "info";
  message: string;
} | null;

export default function WorkOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  const hourlyRate = 35;

  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingPart, setSavingPart] = useState(false);
  const [savingService, setSavingService] = useState(false);
  const [rowUpdatingId, setRowUpdatingId] = useState<string | null>(null);

  const [showPartsModal, setShowPartsModal] = useState(false);
  const [partSearch, setPartSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [partForm, setPartForm] = useState({
    quantity: 1,
    custom_price: "",
  });

  const [showServiceModal, setShowServiceModal] = useState(false);

  const [newService, setNewService] = useState({
    title: "",
    hours: 1,
    notes: "",
    custom_price: "",
    service_date: new Date().toISOString().split("T")[0],
  });

  const [toast, setToast] = useState<Toast>(null);

  const [partQtyDrafts, setPartQtyDrafts] = useState<Record<string, string>>({});
  const [partPriceDrafts, setPartPriceDrafts] = useState<Record<string, string>>({});

  const [serviceHoursDrafts, setServiceHoursDrafts] = useState<Record<string, string>>({});
  const [servicePriceDrafts, setServicePriceDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadData() {
    setLoading(true);

    const [
      { data: orderData, error: orderError },
      { data: productData, error: productError },
      { data: partsData, error: partsError },
      { data: servicesData, error: servicesError },
    ] = await Promise.all([
      supabase
        .from("work_orders")
        .select(
          `
            *,
            customers(*),
            bikes(*)
          `
        )
        .eq("id", id)
        .single(),
      supabase.from("products").select("*").order("title", { ascending: true }),
      supabase
        .from("work_order_parts")
        .select("*")
        .eq("work_order_id", id)
        .order("id", { ascending: true }),
      supabase
        .from("work_order_services")
        .select("*")
        .eq("work_order_id", id)
        .order("service_date", { ascending: true }),
    ]);

    if (orderError) {
      console.error("Errore caricamento work order:", orderError);
      setToast({
        type: "error",
        message: `Errore caricamento scheda: ${orderError.message}`,
      });
      setLoading(false);
      return;
    }

    if (productError) {
      console.error("Errore caricamento prodotti:", productError);
    }

    if (partsError) {
      console.error("Errore caricamento ricambi:", partsError);
    }

    if (servicesError) {
      console.error("Errore caricamento interventi:", servicesError);
    }

    setOrder((orderData as WorkOrder) || null);
    setProducts((productData as Product[]) || []);
    setParts((partsData as Part[]) || []);
    setServices((servicesData as Service[]) || []);
    setPartQtyDrafts({});
    setPartPriceDrafts({});
    setServiceHoursDrafts({});
    setServicePriceDrafts({});
    setLoading(false);
  }

  const productsMap = useMemo(() => {
    const map: Record<string, Product> = {};
    products.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [products]);

  const filteredProducts =
    partSearch.trim().length >= 2
      ? products.filter((p) => {
        const q = partSearch.toLowerCase();
        return (
          (p.title || "").toLowerCase().includes(q) ||
          (p.ean || "").toLowerCase().includes(q)
        );
      })
      : [];

  async function upsertPartMovement(productId: string, finalQty: number) {
    const { data: movementRows, error: readError } = await supabase
      .from("inventory_movements")
      .select("id")
      .eq("product_id", productId)
      .eq("work_order_id", id)
      .eq("type", "officina");

    if (readError) {
      return { error: readError };
    }

    if (!movementRows || movementRows.length === 0) {
      const { error } = await supabase.from("inventory_movements").insert({
        product_id: productId,
        quantity: -finalQty,
        type: "officina",
        work_order_id: id,
      });

      return { error };
    }

    const movementId = movementRows[0].id;

    const { error } = await supabase
      .from("inventory_movements")
      .update({
        quantity: -finalQty,
      })
      .eq("id", movementId);

    return { error };
  }

  async function savePart() {
    if (!selectedProduct) {
      setToast({ type: "error", message: "Seleziona un prodotto." });
      return;
    }

    const existingPart = parts.find((part) => part.product_id === selectedProduct.id);
    if (existingPart) {
      setToast({
        type: "info",
        message: "Questo ricambio è già presente. Modifica la quantità direttamente nella riga.",
      });
      return;
    }

    const qty = Number(partForm.quantity) || 1;
    if (qty <= 0) {
      setToast({ type: "error", message: "Inserisci una quantità valida." });
      return;
    }

    const stock = Number(selectedProduct.warehouse_qty || 0);
    if (stock < qty) {
      setToast({
        type: "error",
        message: `Magazzino insufficiente. Disponibili: ${stock}`,
      });
      return;
    }

    setSavingPart(true);

    const { error: partError } = await supabase.from("work_order_parts").insert({
      work_order_id: id,
      product_id: selectedProduct.id,
      quantity: qty,
      price_snapshot: selectedProduct.price_b2c ?? 0,
      custom_price:
        partForm.custom_price !== "" ? Number(partForm.custom_price) : null,
      billable: true,
    });

    if (partError) {
      console.error("Errore inserimento ricambio:", partError);
      setToast({
        type: "error",
        message: `Errore inserimento ricambio: ${partError.message}`,
      });
      setSavingPart(false);
      return;
    }

    const { error: stockError } = await supabase
      .from("products")
      .update({
        warehouse_qty: stock - qty,
      })
      .eq("id", selectedProduct.id);

    if (stockError) {
      console.error("Errore update magazzino:", stockError);
      setToast({
        type: "error",
        message: `Ricambio inserito ma errore magazzino: ${stockError.message}`,
      });
      setSavingPart(false);
      await loadData();
      return;
    }

    const { error: movementError } = await upsertPartMovement(selectedProduct.id, qty);

    if (movementError) {
      console.error("Errore inserimento movimento:", movementError);
      setToast({
        type: "error",
        message: `Ricambio inserito ma errore movimento magazzino: ${movementError.message}`,
      });
      setSavingPart(false);
      await loadData();
      return;
    }

    setShowPartsModal(false);
    setSelectedProduct(null);
    setPartSearch("");
    setPartForm({ quantity: 1, custom_price: "" });
    await loadData();
    setSavingPart(false);

    setToast({
      type: "success",
      message: "Ricambio aggiunto correttamente.",
    });
  }

  async function deletePart(partId: string) {
    const part = parts.find((p) => p.id === partId);
    if (!part) return;

    const ok = window.confirm("Eliminare questo ricambio dalla scheda?");
    if (!ok) return;

    setRowUpdatingId(partId);

    const product = productsMap[part.product_id];
    const currentStock = Number(product?.warehouse_qty || 0);
    const restoreQty = Number(part.quantity || 0);

    const { error: deletePartError } = await supabase
      .from("work_order_parts")
      .delete()
      .eq("id", partId);

    if (deletePartError) {
      console.error("Errore eliminazione ricambio:", deletePartError);
      setToast({
        type: "error",
        message: `Errore eliminazione ricambio: ${deletePartError.message}`,
      });
      setRowUpdatingId(null);
      return;
    }

    const { error: restoreStockError } = await supabase
      .from("products")
      .update({
        warehouse_qty: currentStock + restoreQty,
      })
      .eq("id", part.product_id);

    if (restoreStockError) {
      console.error("Errore ripristino stock:", restoreStockError);
      setToast({
        type: "error",
        message: `Ricambio eliminato ma errore ripristino magazzino: ${restoreStockError.message}`,
      });
      setRowUpdatingId(null);
      await loadData();
      return;
    }

    const { error: deleteMovementError } = await supabase
      .from("inventory_movements")
      .delete()
      .eq("product_id", part.product_id)
      .eq("work_order_id", id)
      .eq("type", "officina");

    if (deleteMovementError) {
      console.error("Errore rimozione movimento:", deleteMovementError);
      setToast({
        type: "error",
        message: `Ricambio eliminato ma errore movimento magazzino: ${deleteMovementError.message}`,
      });
      setRowUpdatingId(null);
      await loadData();
      return;
    }

    await loadData();
    setRowUpdatingId(null);

    setToast({
      type: "success",
      message: "Ricambio eliminato correttamente.",
    });
  }

  async function updateQty(partId: string, qty: number) {
    if (!Number.isFinite(qty) || qty <= 0) {
      setToast({
        type: "error",
        message: "La quantità deve essere maggiore di zero.",
      });
      return false;
    }

    const part = parts.find((p) => p.id === partId);
    if (!part) {
      setToast({
        type: "error",
        message: "Ricambio non trovato.",
      });
      return false;
    }

    const product = productsMap[part.product_id];
    if (!product) {
      setToast({
        type: "error",
        message: "Prodotto non trovato.",
      });
      return false;
    }

    const oldQty = Number(part.quantity || 0);
    if (qty === oldQty) {
      return true;
    }

    const currentStock = Number(product.warehouse_qty || 0);
    const delta = qty - oldQty;
    const newStock = currentStock - delta;

    if (newStock < 0) {
      setToast({
        type: "error",
        message: `Quantità non disponibile. Disponibili: ${currentStock}`,
      });
      return false;
    }

    setRowUpdatingId(partId);

    const { data: updatedPart, error: partError } = await supabase
      .from("work_order_parts")
      .update({ quantity: qty })
      .eq("id", partId)
      .select("id, quantity, product_id")
      .single();

    if (partError || !updatedPart) {
      console.error("Errore update quantità riga:", partError);
      setToast({
        type: "error",
        message: "Salvataggio quantità non riuscito.",
      });
      setRowUpdatingId(null);
      return false;
    }

    const { data: updatedProduct, error: stockError } = await supabase
      .from("products")
      .update({ warehouse_qty: newStock })
      .eq("id", part.product_id)
      .select("id, warehouse_qty")
      .single();

    if (stockError || !updatedProduct) {
      console.error("Errore update magazzino:", stockError);

      await supabase
        .from("work_order_parts")
        .update({ quantity: oldQty })
        .eq("id", partId);

      setToast({
        type: "error",
        message: "Quantità non salvata: errore aggiornamento magazzino.",
      });
      setRowUpdatingId(null);
      await loadData();
      return false;
    }

    const { error: deleteMovementError } = await supabase
      .from("inventory_movements")
      .delete()
      .eq("product_id", part.product_id)
      .eq("work_order_id", id)
      .eq("type", "officina");

    if (deleteMovementError) {
      console.error("Errore cancellazione vecchio movimento:", deleteMovementError);

      await supabase
        .from("work_order_parts")
        .update({ quantity: oldQty })
        .eq("id", partId);

      await supabase
        .from("products")
        .update({ warehouse_qty: currentStock })
        .eq("id", part.product_id);

      setToast({
        type: "error",
        message: "Quantità non salvata: errore aggiornamento movimento.",
      });
      setRowUpdatingId(null);
      await loadData();
      return false;
    }

    const { error: insertMovementError } = await supabase
      .from("inventory_movements")
      .insert({
        product_id: part.product_id,
        work_order_id: id,
        type: "officina",
        quantity: -qty,
      });

    if (insertMovementError) {
      console.error("Errore inserimento nuovo movimento:", insertMovementError);

      await supabase
        .from("work_order_parts")
        .update({ quantity: oldQty })
        .eq("id", partId);

      await supabase
        .from("products")
        .update({ warehouse_qty: currentStock })
        .eq("id", part.product_id);

      await supabase
        .from("inventory_movements")
        .delete()
        .eq("product_id", part.product_id)
        .eq("work_order_id", id)
        .eq("type", "officina");

      await supabase
        .from("inventory_movements")
        .insert({
          product_id: part.product_id,
          work_order_id: id,
          type: "officina",
          quantity: -oldQty,
        });

      setToast({
        type: "error",
        message: "Quantità non salvata: errore aggiornamento movimento.",
      });
      setRowUpdatingId(null);
      await loadData();
      return false;
    }

    setRowUpdatingId(null);
    return true;
  }

  async function updateCustomPrice(partId: string, price: number | null) {
    setRowUpdatingId(partId);

    const { data: updatedPart, error } = await supabase
      .from("work_order_parts")
      .update({ custom_price: price })
      .eq("id", partId)
      .select("id, custom_price")
      .single();

    if (error || !updatedPart) {
      console.error("Errore update prezzo:", error);
      setToast({
        type: "error",
        message: "Salvataggio prezzo non riuscito.",
      });
      setRowUpdatingId(null);
      return false;
    }

    setToast({
      type: "success",
      message: "Prezzo salvato.",
    });

    await loadData();
    setRowUpdatingId(null);
    return true;
  }

  const hasPendingPartChanges = useMemo(() => {
    return parts.some((p) => {
      const product = productsMap[p.product_id];
      const listino = Number(p.price_snapshot ?? product?.price_b2c ?? 0);

      const qtyDraft = partQtyDrafts[p.id];
      const priceDraft = partPriceDrafts[p.id];

      const qtyChanged =
        qtyDraft !== undefined &&
        Math.max(1, Number(qtyDraft) || 1) !== Number(p.quantity || 0);

      const normalizedPriceDraft = (priceDraft ?? "").trim();
      const effectiveCurrentPrice = Number(p.custom_price ?? listino);

      const priceChanged =
        priceDraft !== undefined &&
        (
          (normalizedPriceDraft === "" && p.custom_price !== null && p.custom_price !== undefined) ||
          (normalizedPriceDraft !== "" &&
            Number(normalizedPriceDraft.replace(",", ".")) !== effectiveCurrentPrice)
        );

      return qtyChanged || priceChanged;
    });
  }, [parts, productsMap, partQtyDrafts, partPriceDrafts]);

  async function savePartsChanges() {
    if (savingPart || rowUpdatingId) return;
    if (!hasPendingPartChanges) {
      setToast({
        type: "info",
        message: "Non ci sono modifiche da salvare nei ricambi.",
      });
      return;
    }

    setSavingPart(true);

    for (const p of parts) {
      const product = productsMap[p.product_id];
      const listino = Number(p.price_snapshot ?? product?.price_b2c ?? 0);

      const qtyDraft = partQtyDrafts[p.id];
      const priceDraft = partPriceDrafts[p.id];

      if (qtyDraft !== undefined) {
        const nextQty = Math.max(1, Number(qtyDraft) || 1);
        if (nextQty !== Number(p.quantity || 0)) {
          const qtyOk = await updateQty(p.id, nextQty);
          if (!qtyOk) {
            setSavingPart(false);
            return;
          }
        }
      }

      if (priceDraft !== undefined) {
        const raw = priceDraft.trim();

        if (raw === "") {
          if (p.custom_price !== null && p.custom_price !== undefined) {
            const priceOk = await updateCustomPrice(p.id, null);
            if (!priceOk) {
              setSavingPart(false);
              return;
            }
          }
        } else {
          const parsed = Number(raw.replace(",", "."));

          if (!Number.isFinite(parsed) || parsed < 0) {
            setToast({
              type: "error",
              message: "Uno dei prezzi inseriti non è valido.",
            });
            setSavingPart(false);
            return;
          }

          const effectiveCurrentPrice = Number(p.custom_price ?? listino);
          if (parsed !== effectiveCurrentPrice) {
            const priceOk = await updateCustomPrice(p.id, parsed);
            if (!priceOk) {
              setSavingPart(false);
              return;
            }
          }
        }
      }
    }

    setPartQtyDrafts({});
    setPartPriceDrafts({});
    await loadData();
    setSavingPart(false);

    setToast({
      type: "success",
      message: "Ricambi salvati correttamente.",
    });
  }

  async function toggleBillable(partId: string, current: boolean) {
    setRowUpdatingId(partId);

    const { error } = await supabase
      .from("work_order_parts")
      .update({ billable: !current })
      .eq("id", partId);

    if (error) {
      console.error("Errore update fatturabile:", error);
      setToast({
        type: "error",
        message: `Errore update fatturabile: ${error.message}`,
      });
      setRowUpdatingId(null);
      return;
    }

    setParts((prev) =>
      prev.map((part) =>
        part.id === partId
          ? {
            ...part,
            billable: !current,
          }
          : part
      )
    );

    setRowUpdatingId(null);
  }

  async function saveService() {
    const hours = Number(newService.hours) || 0;
    const customPrice =
      newService.custom_price !== "" ? Number(newService.custom_price) : null;

    if (!newService.title.trim()) {
      setToast({
        type: "error",
        message: "Inserisci il titolo dell’intervento.",
      });
      return;
    }

    setSavingService(true);

    const { error } = await supabase.from("work_order_services").insert({
      work_order_id: id,
      title: newService.title.trim(),
      hours,
      notes: newService.notes.trim() || null,
      custom_price: customPrice,
      billable: true,
      service_date: newService.service_date || null,
    });

    if (error) {
      console.error("Errore inserimento intervento:", error);
      setToast({
        type: "error",
        message: `Errore inserimento intervento: ${error.message}`,
      });
      setSavingService(false);
      return;
    }

    setShowServiceModal(false);
    setNewService({
      title: "",
      hours: 1,
      notes: "",
      custom_price: "",
      service_date: new Date().toISOString().split("T")[0],
    });

    await loadData();
    setSavingService(false);

    setToast({
      type: "success",
      message: "Intervento aggiunto correttamente.",
    });
  }

  async function deleteService(serviceId: string) {
    const ok = window.confirm("Eliminare questo intervento?");
    if (!ok) return;

    setRowUpdatingId(serviceId);

    const { error } = await supabase
      .from("work_order_services")
      .delete()
      .eq("id", serviceId);

    if (error) {
      console.error("Errore eliminazione intervento:", error);
      setToast({
        type: "error",
        message: `Errore eliminazione intervento: ${error.message}`,
      });
      setRowUpdatingId(null);
      return;
    }

    await loadData();
    setRowUpdatingId(null);

    setToast({
      type: "success",
      message: "Intervento eliminato correttamente.",
    });
  }

  async function toggleServiceBillable(serviceId: string, current: boolean) {
    setRowUpdatingId(serviceId);

    const { error } = await supabase
      .from("work_order_services")
      .update({ billable: !current })
      .eq("id", serviceId);

    if (error) {
      console.error("Errore update fatturabile intervento:", error);
      setToast({
        type: "error",
        message: `Errore update fatturabile intervento: ${error.message}`,
      });
      setRowUpdatingId(null);
      return;
    }

    setServices((prev) =>
      prev.map((service) =>
        service.id === serviceId
          ? {
            ...service,
            billable: !current,
          }
          : service
      )
    );

    setRowUpdatingId(null);
  }

  const hasPendingServiceChanges = useMemo(() => {
    return services.some((s) => {
      const hoursDraft = serviceHoursDrafts[s.id];
      const priceDraft = servicePriceDrafts[s.id];

      const normalizedCurrentHours = Number(s.hours ?? 0);
      const normalizedDraftHours =
        hoursDraft !== undefined
          ? Math.round((Number(hoursDraft.replace(",", ".")) || 0) * 2) / 2
          : normalizedCurrentHours;

      const hoursChanged =
        hoursDraft !== undefined &&
        normalizedDraftHours !== normalizedCurrentHours;

      const effectiveCurrentPrice = Number(
        s.custom_price ?? Number(s.hours || 0) * hourlyRate
      );

      const priceChanged =
        priceDraft !== undefined &&
        (
          (priceDraft.trim() === "" &&
            s.custom_price !== null &&
            s.custom_price !== undefined) ||
          (priceDraft.trim() !== "" &&
            Number(priceDraft.replace(",", ".")) !== effectiveCurrentPrice)
        );

      return hoursChanged || priceChanged;
    });
  }, [services, serviceHoursDrafts, servicePriceDrafts, hourlyRate]);

  async function updateServiceHours(serviceId: string, hours: number) {
    if (!Number.isFinite(hours) || hours < 0) {
      setToast({
        type: "error",
        message: "Le ore devono essere un valore valido.",
      });
      return false;
    }

    const normalizedHours = Math.round(hours * 2) / 2;

    const { data: updatedService, error } = await supabase
      .from("work_order_services")
      .update({ hours: normalizedHours })
      .eq("id", serviceId)
      .select("id, hours")
      .single();

    if (error || !updatedService) {
      console.error("Errore update ore intervento:", error);
      setToast({
        type: "error",
        message: "Salvataggio ore non riuscito.",
      });
      return false;
    }

    return true;
  }

  async function updateServiceCustomPrice(serviceId: string, price: number | null) {
    const { data: updatedService, error } = await supabase
      .from("work_order_services")
      .update({ custom_price: price })
      .eq("id", serviceId)
      .select("id, custom_price")
      .single();

    if (error || !updatedService) {
      console.error("Errore update prezzo intervento:", error);
      setToast({
        type: "error",
        message: "Salvataggio prezzo non riuscito.",
      });
      return false;
    }

    return true;
  }

  async function saveServicesChanges() {
    if (savingService || rowUpdatingId) return;

    if (!hasPendingServiceChanges) {
      setToast({
        type: "info",
        message: "Non ci sono modifiche da salvare negli interventi.",
      });
      return;
    }

    setSavingService(true);

    for (const s of services) {
      const hoursDraft = serviceHoursDrafts[s.id];
      const priceDraft = servicePriceDrafts[s.id];

      if (hoursDraft !== undefined) {
        const parsedHours = Number(hoursDraft.replace(",", "."));
        const normalizedHours = Math.round((parsedHours || 0) * 2) / 2;

        if (!Number.isFinite(parsedHours) || parsedHours < 0) {
          setToast({
            type: "error",
            message: "Uno dei valori ore non è valido.",
          });
          setSavingService(false);
          return;
        }

        if (normalizedHours !== Number(s.hours ?? 0)) {
          const hoursOk = await updateServiceHours(s.id, normalizedHours);
          if (!hoursOk) {
            setSavingService(false);
            return;
          }
        }
      }

      if (priceDraft !== undefined) {
        const raw = priceDraft.trim();

        if (raw === "") {
          if (s.custom_price !== null && s.custom_price !== undefined) {
            const priceOk = await updateServiceCustomPrice(s.id, null);
            if (!priceOk) {
              setSavingService(false);
              return;
            }
          }
        } else {
          const parsed = Number(raw.replace(",", "."));

          if (!Number.isFinite(parsed) || parsed < 0) {
            setToast({
              type: "error",
              message: "Uno dei prezzi inseriti non è valido.",
            });
            setSavingService(false);
            return;
          }

          const effectiveCurrentPrice = Number(
            s.custom_price ?? Number(s.hours || 0) * hourlyRate
          );

          if (parsed !== effectiveCurrentPrice) {
            const priceOk = await updateServiceCustomPrice(s.id, parsed);
            if (!priceOk) {
              setSavingService(false);
              return;
            }
          }
        }
      }
    }

    setServiceHoursDrafts({});
    setServicePriceDrafts({});
    await loadData();
    setSavingService(false);

    setToast({
      type: "success",
      message: "Interventi salvati correttamente.",
    });
  }

  const partsTotal = useMemo(() => {
    return parts.reduce((acc, p) => {
      const product = productsMap[p.product_id];
      const listino = Number(p.price_snapshot ?? product?.price_b2c ?? 0);
      const price = Number(p.custom_price ?? listino);
      return acc + price * Number(p.quantity || 0);
    }, 0);
  }, [parts, productsMap]);

  const serviceTotal = useMemo(() => {
    return services.reduce((acc, s) => {
      const price = Number(s.custom_price ?? Number(s.hours || 0) * hourlyRate);
      return acc + price;
    }, 0);
  }, [services]);

  const total = partsTotal + serviceTotal;

  function formatCurrency(value: number | null | undefined) {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(Number(value || 0));
  }

  if (loading || !order) {
    return <div className="workorder-detail-empty">Caricamento...</div>;
  }

  const bikeSerial = order.bikes?.serial || order.bikes?.serial_number || "-";

  return (
    <div className="app-page-shell workorder-detail-shell">
      {toast && (
        <div
          className={`workorder-detail-toast ${toast.type === "success"
            ? "workorder-detail-toast--success"
            : toast.type === "error"
              ? "workorder-detail-toast--error"
              : "workorder-detail-toast--info"
            }`}
        >
          {toast.message}
        </div>
      )}

      <div className="page-header workorder-detail-header">
        <div className="page-header__left">
          <div className="apple-kicker">Schede officina / Dettaglio</div>
          <h1 className="apple-page-title">Scheda lavoro</h1>
          <p className="apple-page-subtitle workorder-detail-subtitle">
            Gestisci ricambi, interventi e totale cliente in modo chiaro e rapido.
          </p>
        </div>

        <div className="page-header__right workorder-detail-header-actions">
          <button
            onClick={() => router.push("/workorders")}
            className="btn-secondary"
          >
            ← Torna alle schede
          </button>

          <button
            onClick={() => router.push(`/workorders/${id}/report`)}
            className="btn-primary workorder-detail-print-btn"
          >
            <Printer size={16} strokeWidth={2.2} />
            <span>Stampa scheda</span>
          </button>
        </div>
      </div>

      <div className="workorder-detail-info-grid">
        <div className="workorder-detail-card workorder-detail-card--wide">
          <div className="workorder-detail-card-title">Cliente e bici</div>

          <div className="workorder-detail-info-rows">
            <InfoRow label="Cliente" value={order.customers?.name || "-"} />
            <InfoRow label="Telefono" value={order.customers?.phone || "-"} />
            <InfoRow label="Email" value={order.customers?.email || "-"} />
            <InfoRow
              label="Bici"
              value={`${order.bikes?.brand || "-"} ${order.bikes?.model || ""}`.trim()}
            />
            <InfoRow label="Telaio" value={bikeSerial} />
            <InfoRow label="Note" value={order.notes || "-"} />
          </div>
        </div>

        <div className="workorder-detail-card workorder-detail-summary-card">
          <div className="workorder-detail-card-title">Riepilogo economico</div>

          <div className="workorder-detail-money-row">
            <span>Ricambi</span>
            <strong>{formatCurrency(partsTotal)}</strong>
          </div>

          <div className="workorder-detail-money-row">
            <span>Manodopera</span>
            <strong>{formatCurrency(serviceTotal)}</strong>
          </div>

          <div className="workorder-detail-divider" />

          <div className="workorder-detail-total-row">
            <span>Totale cliente</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
        </div>
      </div>

      <section className="workorder-detail-section-card">
        <div className="workorder-detail-section-header">
          <div>
            <h2 className="workorder-detail-section-heading">Ricambi utilizzati</h2>
            <p className="workorder-detail-section-text">
              Aggiungi ricambi alla scheda e gestisci prezzo, quantità e fatturazione.
            </p>
          </div>

          <div className="workorder-detail-section-actions">
            <button
              type="button"
              className="workorder-detail-save-btn"
              onClick={savePartsChanges}
              disabled={savingPart || !hasPendingPartChanges}
            >
              {savingPart ? "Salvataggio..." : "Salva"}
            </button>
            <button
              onClick={() => setShowPartsModal(true)}
              className="btn-primary workorder-detail-add-btn"
            >
              + Aggiungi ricambio
            </button>
          </div>
        </div>

        {parts.length === 0 ? (
          <div className="workorder-detail-empty">
            Nessun ricambio associato a questa scheda.
          </div>
        ) : (
          <div className="workorder-detail-table-wrap">
            <table className="workorder-detail-table">
              <thead>
                <tr>
                  <th>Prodotto</th>
                  <th>Qtà</th>
                  <th>Prezzo</th>
                  <th>Fattura</th>
                  <th>Totale</th>
                  <th>Azioni</th>
                </tr>
              </thead>

              <tbody>
                {parts.map((p) => {
                  const product = productsMap[p.product_id];
                  const listino = Number(p.price_snapshot ?? product?.price_b2c ?? 0);

                  const currentQtyText =
                    partQtyDrafts[p.id] !== undefined
                      ? partQtyDrafts[p.id]
                      : String(p.quantity);

                  const currentQty = Math.max(1, Number(currentQtyText) || 1);

                  const currentPriceText =
                    partPriceDrafts[p.id] !== undefined
                      ? partPriceDrafts[p.id]
                      : String(Number(p.custom_price ?? listino).toFixed(2)).replace(".", ",");

                  const parsedCurrentPrice =
                    Number(currentPriceText.replace(",", ".")) || 0;

                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="workorder-detail-cell-title">
                          {product?.title || "-"}
                        </div>
                        <div className="workorder-detail-cell-sub">
                          EAN: {product?.ean || "-"}
                        </div>
                      </td>

                      <td>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          inputMode="numeric"
                          value={currentQtyText}
                          onChange={(e) => {
                            setPartQtyDrafts((prev) => ({
                              ...prev,
                              [p.id]: e.target.value,
                            }));
                          }}
                          onBlur={(e) => {
                            const raw = e.target.value.trim();
                            const nextQty = Math.max(1, Number(raw) || 1);

                            setPartQtyDrafts((prev) => ({
                              ...prev,
                              [p.id]: String(nextQty),
                            }));
                          }}
                          className="workorder-detail-small-input"
                          disabled={rowUpdatingId === p.id}
                        />
                      </td>

                      <td>
                        <div className="workorder-detail-price-box">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={currentPriceText}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^\d,]/g, "");
                              const normalized = raw.includes(",")
                                ? `${raw.split(",")[0]},${raw.split(",").slice(1).join("")}`
                                : raw;

                              setPartPriceDrafts((prev) => ({
                                ...prev,
                                [p.id]: normalized,
                              }));
                            }}
                            onBlur={() => {
                              const raw = (partPriceDrafts[p.id] ?? "").trim();

                              if (raw === "") {
                                setPartPriceDrafts((prev) => ({
                                  ...prev,
                                  [p.id]: "",
                                }));
                                return;
                              }

                              const parsed = Number(raw.replace(",", "."));

                              if (!Number.isFinite(parsed) || parsed < 0) {
                                setToast({
                                  type: "error",
                                  message: "Inserisci un prezzo valido.",
                                });

                                setPartPriceDrafts((prev) => ({
                                  ...prev,
                                  [p.id]: String(
                                    Number(p.custom_price ?? listino).toFixed(2)
                                  ).replace(".", ","),
                                }));
                                return;
                              }

                              setPartPriceDrafts((prev) => ({
                                ...prev,
                                [p.id]: String(parsed.toFixed(2)).replace(".", ","),
                              }));
                            }}
                            className={`workorder-detail-small-input-wide ${p.custom_price === null || p.custom_price === undefined
                              ? "workorder-detail-small-input-wide--muted"
                              : "workorder-detail-small-input-wide--active"
                              }`}
                            disabled={rowUpdatingId === p.id}
                          />
                        </div>
                      </td>

                      <td>
                        <label className="workorder-detail-checkbox-wrap">
                          <input
                            type="checkbox"
                            checked={Boolean(p.billable)}
                            onChange={() => toggleBillable(p.id, p.billable)}
                            disabled={rowUpdatingId === p.id}
                          />
                          <span>{p.billable ? "Fatturabile" : "Interno"}</span>
                        </label>
                      </td>

                      <td>
                        <strong>
                          {formatCurrency(parsedCurrentPrice * currentQty)}
                        </strong>
                      </td>

                      <td>
                        <button
                          className="workorder-detail-danger-btn"
                          onClick={() => deletePart(p.id)}
                          disabled={rowUpdatingId === p.id}
                        >
                          {rowUpdatingId === p.id ? "..." : "Elimina"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="workorder-detail-section-card">
        <div className="workorder-detail-section-header">
          <div>
            <h2 className="workorder-detail-section-heading">Interventi</h2>
            <p className="workorder-detail-section-text">
              Inserisci lavorazioni, ore e prezzo manuale quando necessario.
            </p>
          </div>

          <div className="workorder-detail-section-actions">
            <button
              type="button"
              className="workorder-detail-save-btn"
              onClick={saveServicesChanges}
              disabled={savingService || !hasPendingServiceChanges}
            >
              {savingService ? "Salvataggio..." : "Salva"}
            </button>
            <button
              onClick={() => setShowServiceModal(true)}
              className="btn-primary workorder-detail-add-btn"
            >
              + Aggiungi intervento
            </button>

          </div>
        </div>

        {services.length === 0 ? (
          <div className="workorder-detail-empty">Nessun intervento registrato.</div>
        ) : (
          <div className="workorder-detail-table-wrap">
            <table className="workorder-detail-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Intervento</th>
                  <th>Ore</th>
                  <th>Note</th>
                  <th>Prezzo</th>
                  <th>Fattura</th>
                  <th>Azioni</th>
                </tr>
              </thead>

              <tbody>
                {services.map((s) => {
                  const currentHoursText =
                    serviceHoursDrafts[s.id] !== undefined
                      ? serviceHoursDrafts[s.id]
                      : String(Number(s.hours ?? 0).toFixed(1)).replace(".0", "");

                  const parsedCurrentHours = Number(currentHoursText.replace(",", ".")) || 0;

                  const currentPriceText =
                    servicePriceDrafts[s.id] !== undefined
                      ? servicePriceDrafts[s.id]
                      : String(
                        Number(
                          s.custom_price ?? Number(s.hours || 0) * hourlyRate
                        ).toFixed(2)
                      ).replace(".", ",");

                  const parsedCurrentPrice =
                    Number(currentPriceText.replace(",", ".")) || 0;

                  return (
                    <tr key={s.id}>
                      <td>{s.service_date || "-"}</td>
                      <td>
                        <div className="workorder-detail-cell-title">{s.title}</div>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          inputMode="decimal"
                          value={currentHoursText}
                          onChange={(e) => {
                            setServiceHoursDrafts((prev) => ({
                              ...prev,
                              [s.id]: e.target.value,
                            }));
                          }}
                          onBlur={(e) => {
                            const raw = e.target.value.trim().replace(",", ".");
                            const parsed = Number(raw);

                            if (!Number.isFinite(parsed) || parsed < 0) {
                              setServiceHoursDrafts((prev) => ({
                                ...prev,
                                [s.id]: String(Number(s.hours ?? 0).toFixed(1)).replace(".0", ""),
                              }));
                              return;
                            }

                            const normalized = Math.round(parsed * 2) / 2;

                            setServiceHoursDrafts((prev) => ({
                              ...prev,
                              [s.id]: String(normalized).replace(".0", ""),
                            }));
                          }}
                          className="workorder-detail-small-input"
                          disabled={rowUpdatingId === s.id}
                        />
                      </td>
                      <td>{s.notes || "-"}</td>
                      <td>
                        <div className="workorder-detail-price-box">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={currentPriceText}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^\d,]/g, "");
                              const normalized = raw.includes(",")
                                ? `${raw.split(",")[0]},${raw.split(",").slice(1).join("")}`
                                : raw;

                              setServicePriceDrafts((prev) => ({
                                ...prev,
                                [s.id]: normalized,
                              }));
                            }}
                            onBlur={() => {
                              const raw = (servicePriceDrafts[s.id] ?? "").trim();

                              if (raw === "") {
                                setServicePriceDrafts((prev) => ({
                                  ...prev,
                                  [s.id]: "",
                                }));
                                return;
                              }

                              const parsed = Number(raw.replace(",", "."));

                              if (!Number.isFinite(parsed) || parsed < 0) {
                                setToast({
                                  type: "error",
                                  message: "Inserisci un prezzo valido.",
                                });

                                setServicePriceDrafts((prev) => ({
                                  ...prev,
                                  [s.id]: String(
                                    Number(
                                      s.custom_price ?? Number(s.hours || 0) * hourlyRate
                                    ).toFixed(2)
                                  ).replace(".", ","),
                                }));
                                return;
                              }

                              setServicePriceDrafts((prev) => ({
                                ...prev,
                                [s.id]: String(parsed.toFixed(2)).replace(".", ","),
                              }));
                            }}
                            className={`workorder-detail-small-input-wide ${s.custom_price === null || s.custom_price === undefined
                                ? "workorder-detail-small-input-wide--muted"
                                : "workorder-detail-small-input-wide--active"
                              }`}
                            disabled={rowUpdatingId === s.id}
                          />
                        </div>
                      </td>
                      <td>
                        <label className="workorder-detail-checkbox-wrap">
                          <input
                            type="checkbox"
                            checked={Boolean(s.billable ?? true)}
                            onChange={() =>
                              toggleServiceBillable(s.id, Boolean(s.billable ?? true))
                            }
                            disabled={rowUpdatingId === s.id}
                          />
                          <span>{Boolean(s.billable ?? true) ? "Fatturabile" : "Interno"}</span>
                        </label>
                      </td>
                      <td>
                        <button
                          className="workorder-detail-danger-btn"
                          onClick={() => deleteService(s.id)}
                          disabled={rowUpdatingId === s.id}
                        >
                          {rowUpdatingId === s.id ? "..." : "Elimina"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showPartsModal && (
        <ModalShell
          title="Aggiungi ricambio"
          subtitle="Cerca un prodotto, selezionalo e definisci quantità e prezzo."
          icon={<Wrench size={22} strokeWidth={2.2} />}
        >
          <input
            placeholder="Cerca prodotto o EAN..."
            value={partSearch}
            onChange={(e) => setPartSearch(e.target.value)}
            className="apple-input workorder-modal-input"
          />

          <div className="workorder-modal-results">
            {partSearch.trim().length < 2 ? (
              <div className="workorder-detail-empty">
                Scrivi almeno 2 caratteri per cercare.
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="workorder-detail-empty">Nessun prodotto trovato.</div>
            ) : (
              filteredProducts.map((p) => {
                const isSelected = selectedProduct?.id === p.id;
                const isOutOfStock = Number(p.warehouse_qty || 0) <= 0;
                const isAlreadyInSheet = parts.some((part) => part.product_id === p.id);

                return (
                  <div key={p.id} className="workorder-modal-product-card">
                    <div>
                      <div className="workorder-detail-cell-title">{p.title}</div>
                      <div className="workorder-detail-cell-sub">EAN {p.ean || "-"}</div>
                      <div className="workorder-modal-product-price">
                        {formatCurrency(p.price_b2c)}
                      </div>
                      <div className="workorder-detail-cell-sub">
                        Disponibili: {Number(p.warehouse_qty || 0)}
                      </div>
                    </div>

                    {isAlreadyInSheet ? (
                      <div className="workorder-modal-stock-badge">
                        Già presente
                      </div>
                    ) : !isSelected ? (
                      <button
                        onClick={() => setSelectedProduct(p)}
                        className="btn-secondary workorder-modal-select-btn"
                      >
                        Seleziona
                      </button>
                    ) : isOutOfStock ? (
                      <div className="workorder-modal-stock-badge workorder-modal-stock-badge--out">
                        Esaurito
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          {selectedProduct && (
            <div className="workorder-modal-selected-box">
              <div className="workorder-modal-selected-title">{selectedProduct.title}</div>

              <div className="workorder-modal-grid">
                <div>
                  <label className="workorder-modal-label">Quantità</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={partForm.quantity}
                    onChange={(e) =>
                      setPartForm({
                        ...partForm,
                        quantity: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className="apple-input workorder-modal-input"
                  />
                </div>

                <div>
                  <label className="workorder-modal-label">Prezzo custom</label>
                  <input
                    type="number"
                    step="0.01"
                    value={partForm.custom_price}
                    placeholder={String(selectedProduct.price_b2c || "")}
                    onChange={(e) =>
                      setPartForm({
                        ...partForm,
                        custom_price: e.target.value,
                      })
                    }
                    className="apple-input workorder-modal-input"
                  />
                </div>
              </div>

              <div className="workorder-modal-footer">
                <button
                  onClick={() => {
                    setShowPartsModal(false);
                    setSelectedProduct(null);
                    setPartSearch("");
                    setPartForm({ quantity: 1, custom_price: "" });
                  }}
                  className="btn-secondary"
                  disabled={savingPart}
                >
                  Annulla
                </button>

                <button
                  onClick={savePart}
                  className="btn-primary workorder-modal-primary-btn"
                  disabled={savingPart}
                >
                  {savingPart ? "Salvataggio..." : "Aggiungi ricambio"}
                </button>
              </div>
            </div>
          )}

          {!selectedProduct && (
            <div className="workorder-modal-footer">
              <button
                onClick={() => {
                  setShowPartsModal(false);
                  setSelectedProduct(null);
                  setPartSearch("");
                  setPartForm({ quantity: 1, custom_price: "" });
                }}
                className="btn-primary workorder-modal-primary-btn"
              >
                Chiudi
              </button>
            </div>
          )}
        </ModalShell>
      )}

      {showServiceModal && (
        <ModalShell
          title="Nuovo intervento"
          subtitle="Inserisci i dati dell’intervento di officina."
          icon={<ClipboardPenLine size={22} strokeWidth={2.2} />}
        >
          <div className="workorder-modal-grid-single">
            <div>
              <label className="workorder-modal-label">Data</label>
              <input
                type="date"
                value={newService.service_date}
                onChange={(e) =>
                  setNewService({ ...newService, service_date: e.target.value })
                }
                className="apple-input workorder-modal-input"
              />
            </div>

            <div>
              <label className="workorder-modal-label">Intervento</label>
              <input
                value={newService.title}
                onChange={(e) =>
                  setNewService({ ...newService, title: e.target.value })
                }
                placeholder="es. Regolazione cambio"
                className="apple-input workorder-modal-input"
              />
            </div>

            <div>
              <label className="workorder-modal-label">Ore</label>
              <input
                type="number"
                step="0.25"
                value={newService.hours}
                onChange={(e) =>
                  setNewService({
                    ...newService,
                    hours: Number(e.target.value),
                  })
                }
                className="apple-input workorder-modal-input"
              />
            </div>

            <div>
              <label className="workorder-modal-label">Prezzo manuale</label>
              <input
                type="text"
                inputMode="decimal"
                value={newService.custom_price.replace(".", ",")}
                onChange={(e) =>
                  setNewService({
                    ...newService,
                    custom_price: e.target.value.replace(",", "."),
                  })
                }
                placeholder="0,00 €"
                className="apple-input workorder-modal-input workorder-modal-price-input"
              />
            </div>

            <div>
              <label className="workorder-modal-label">Note</label>
              <textarea
                rows={4}
                value={newService.notes}
                onChange={(e) =>
                  setNewService({ ...newService, notes: e.target.value })
                }
                className="apple-textarea workorder-modal-textarea"
              />
            </div>
          </div>

          <div className="workorder-modal-footer">
            <button
              onClick={() => setShowServiceModal(false)}
              className="btn-primary workorder-modal-cancel-btn"
              disabled={savingService}
            >
              Annulla
            </button>

            <button
              onClick={saveService}
              className="btn-primary workorder-modal-primary-btn"
              disabled={savingService}
            >
              {savingService ? "Salvataggio..." : "Salva intervento"}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="workorder-detail-info-row">
      <span className="workorder-detail-info-label">{label}</span>
      <span className="workorder-detail-info-value">{value}</span>
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
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="workorder-modal-overlay">
      <div className="workorder-modal-card">
        <div className="workorder-modal-header">
          <div className="workorder-modal-icon">{icon || "✨"}</div>
          <div>
            <h2 className="workorder-modal-title">{title}</h2>
            {subtitle ? (
              <p className="workorder-modal-subtitle">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="workorder-modal-content">{children}</div>
      </div>
    </div>
  );
}