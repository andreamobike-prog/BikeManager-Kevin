"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem("app_auth");
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      style={{
        marginTop: "auto",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 8,
        color: "#b91c1c",
        fontWeight: 700,
        background: "#fef2f2",
        border: "1px solid #fecaca",
        cursor: "pointer",
      }}
    >
      🚪 Logout
    </button>
  );
}