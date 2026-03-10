Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const NOTILIFY_API_KEY = Deno.env.get("NOTILIFY_API_KEY");
    if (!NOTILIFY_API_KEY) {
      return json({ error: "NOTILIFY_API_KEY not configured" }, 500);
    }

    const body = await req.json();
    const { student_id, parent_phone, student_name, token, app_url } = body;

    if (!student_id || !parent_phone || !token) {
      return json({ error: "student_id, parent_phone, and token are required" }, 400);
    }

    const inviteUrl = `${app_url || "https://unitylearning.lovable.app"}/parent-signup?token=${token}`;
    const message = `📚 UnityClass: ${student_name || "Your child"} has added you as their parent. Create your parent account to track their grades & attendance:\n${inviteUrl}`;

    const res = await fetch("https://api.notilify.com/v1/messages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTILIFY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: parent_phone,
        from: "UnityClass",
        body: message,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      console.error("Notilify error:", result);
      return json({ error: result.message || "Failed to send SMS" }, 500);
    }

    return json({ success: true, id: result.id });
  } catch (err) {
    console.error("invite-parent error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
