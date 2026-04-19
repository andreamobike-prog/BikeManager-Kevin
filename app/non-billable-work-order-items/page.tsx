"use client";

import { redirect } from "next/navigation";

export default function NonBillableWorkOrderItemsPage() {
  redirect("/workorders/archive");
}