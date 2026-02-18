Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-setup-key",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const setupKey = req.headers.get("x-setup-key");
  if (setupKey !== "UNITYCLASS_BOOTSTRAP_2026") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const email = "serxho1100@gmail.com";
  const password = "qweiop11100";
  const full_name = "Serxho Vasili";

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u: any) => u.email === email);

    if (existing) {
      // Update profile name
      await supabase.from("profiles").update({ full_name }).eq("user_id", existing.id);
      // Update role to super_admin
      const { data: roleRow } = await supabase.from("user_roles").select("id").eq("user_id", existing.id).maybeSingle();
      if (roleRow) {
        await supabase.from("user_roles").update({ role: "super_admin" }).eq("user_id", existing.id);
      } else {
        await supabase.from("user_roles").insert({ user_id: existing.id, role: "super_admin" });
      }
      return json({ message: "Existing user updated to super_admin", id: existing.id });
    }

    // Create new auth user
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createErr || !newUser?.user) {
      return json({ error: createErr?.message || "Failed to create user" }, 400);
    }

    // Wait briefly for trigger to fire (creates profile + student role)
    await new Promise(r => setTimeout(r, 1000));

    // Update profile name
    await supabase.from("profiles").update({ full_name }).eq("user_id", newUser.user.id);

    // Update role to super_admin
    const { data: roleRow } = await supabase.from("user_roles").select("id").eq("user_id", newUser.user.id).maybeSingle();
    if (roleRow) {
      await supabase.from("user_roles").update({ role: "super_admin" }).eq("user_id", newUser.user.id);
    } else {
      await supabase.from("user_roles").insert({ user_id: newUser.user.id, role: "super_admin" });
    }

    return json({ message: "Super admin created successfully", id: newUser.user.id, email }, 201);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
