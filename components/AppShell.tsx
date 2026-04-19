"use client";

import { usePathname } from "next/navigation";
import AuthGuard from "./AuthGuard";
import AppSidebar from "./AppSidebar";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hideSidebar = pathname === "/login";

  if (hideSidebar) {
    return <AuthGuard>{children}</AuthGuard>;
  }

  return (
    <AuthGuard>
      <div style={shell}>
        <AppSidebar />
        <main style={main}>{children}</main>
      </div>
    </AuthGuard>
  );
}

const shell: React.CSSProperties = {
  display: "flex",
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, #eef4ff 0%, #f8fafc 38%, #f3f6fb 100%)",
};

const main: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};
