"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.replace("/dashboard");
      }
    }

    checkSession();
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message || "Email o password non corretti.");
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <div style={page}>
      <div style={card}>
        <div style={logo}>GK</div>

        <h1 style={title}>Gestionale Kevin</h1>
        <p style={subtitle}>Inserisci email e password per continuare.</p>

        <form onSubmit={handleLogin} style={form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={input}
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={input}
            required
          />

          {error ? <div style={errorBox}>{error}</div> : null}

          <button type="submit" style={button} disabled={loading}>
            {loading ? "Accesso..." : "Accedi"}
          </button>
        </form>
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(180deg,#f8fafc 0%, #eef2f7 100%)",
  padding: 24,
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  background: "rgba(255,255,255,0.9)",
  border: "1px solid rgba(15,23,42,0.08)",
  borderRadius: 24,
  padding: 28,
  boxShadow: "0 20px 50px rgba(15,23,42,0.08)",
};

const logo: React.CSSProperties = {
  width: 60,
  height: 60,
  borderRadius: 18,
  background: "#dbeafe",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 28,
  marginBottom: 16,
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 800,
  color: "#0f172a",
};

const subtitle: React.CSSProperties = {
  marginTop: 8,
  marginBottom: 20,
  color: "#64748b",
  fontSize: 14,
};

const form: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const input: React.CSSProperties = {
  padding: "13px 14px",
  borderRadius: 14,
  border: "1px solid #dbe2ea",
  outline: "none",
  fontSize: 14,
};

const button: React.CSSProperties = {
  marginTop: 4,
  background: "linear-gradient(180deg,#1185ff 0%, #0071e3 100%)",
  color: "white",
  border: "none",
  borderRadius: 14,
  padding: "13px 16px",
  fontWeight: 700,
};

const errorBox: React.CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "1px solid #fca5a5",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 14,
};
