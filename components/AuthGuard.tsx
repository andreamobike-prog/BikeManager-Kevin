"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";

const PUBLIC_ROUTES = new Set(["/login"]);
const PUBLIC_PREFIXES = ["/auth/callback", "/callback"];

function isPublicRoute(pathname: string) {
  return (
    PUBLIC_ROUTES.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export default function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;

    function applyAuthState(session: Session | null) {
      if (!mounted) return;

      const publicRoute = isPublicRoute(pathname);
      const redirectAuthenticated = pathname === "/" || pathname === "/login";

      if (session) {
        if (redirectAuthenticated) {
          router.replace("/dashboard");
          return;
        }

        setAllowed(true);
        setLoading(false);
        return;
      }

      if (publicRoute) {
        setAllowed(true);
        setLoading(false);
        return;
      }

      router.replace("/login");
    }

    async function runCheck() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      applyAuthState(session);
    }

    runCheck();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) =>
      applyAuthState(session)
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (loading) {
    return <div style={{ padding: 40 }}>Verifica accesso...</div>;
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
