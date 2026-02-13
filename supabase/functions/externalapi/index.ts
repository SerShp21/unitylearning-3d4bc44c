Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("UNITYCLASS_API_KEY");
  if (!apiKey || apiKey !== expectedKey) {
    return new Response(JSON.stringify({ error: "Invalid or missing API key" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const resource = url.searchParams.get("resource");

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    switch (resource) {
      case "classes": {
        const { data, error } = await supabase.from("classes").select("*");
        if (error) throw error;
        return json({ data });
      }
      case "timetable": {
        const { data, error } = await supabase.from("timetable_entries").select("*, classes(name, subject)");
        if (error) throw error;
        return json({ data });
      }
      case "users": {
        const { data: profiles, error: pErr } = await supabase.from("profiles").select("*");
        if (pErr) throw pErr;
        const { data: roles, error: rErr } = await supabase.from("user_roles").select("*");
        if (rErr) throw rErr;
        const users = (profiles ?? []).map((p: any) => ({
          ...p,
          role: roles?.find((r: any) => r.user_id === p.user_id)?.role ?? "student",
        }));
        return json({ data: users });
      }
      case "enrollments": {
        const { data, error } = await supabase.from("class_enrollments").select("*, classes(name)");
        if (error) throw error;
        return json({ data });
      }
      default:
        return json({ error: "Missing or invalid 'resource' param", available: ["classes", "timetable", "users", "enrollments"] }, 400);
    }
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
