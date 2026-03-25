async function handleLogin(e: React.FormEvent) {
  e.preventDefault();
  setError("");
  setLoading(true);

  console.log("SUPABASE URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log(
    "SUPABASE KEY PREFIX:",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 20)
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  console.log("LOGIN DATA:", data);
  console.log("LOGIN ERROR:", error);

  if (error) {
    setError(error.message || "Email o password non corretti.");
    setLoading(false);
    return;
  }

  router.replace("/");
}