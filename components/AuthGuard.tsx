"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { usePathname, useRouter } from "next/navigation";

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

    async function runCheck() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      const isLoginPage = pathname === "/login";

      if (session) {
        if (isLoginPage) {
          router.replace("/");
          return;
        }

        setAllowed(true);
        setLoading(false);
        return;
      }

      if (!session) {
        if (isLoginPage) {
          setAllowed(true);
          setLoading(false);
          return;
        }

        router.replace("/login");
        return;
      }
    }

    runCheck();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const isLoginPage = pathname === "/login";

      if (session) {
        if (isLoginPage) {
          router.replace("/");
          return;
        }

        setAllowed(true);
        setLoading(false);
        return;
      }

      if (!session) {
        if (isLoginPage) {
          setAllowed(true);
          setLoading(false);
          return;
        }

        router.replace("/login");
      }
    });

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