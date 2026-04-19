"use client";

import { usePathname } from "next/navigation";
import AppSidebar from "./AppSidebar";

export default function RouteShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="apple-app">
      <AppSidebar />
      <main className="apple-app__main">
        <div className="apple-app__content">{children}</div>
      </main>
    </div>
  );
}