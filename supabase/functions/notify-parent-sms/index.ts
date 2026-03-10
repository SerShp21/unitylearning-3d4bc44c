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
    const { type, parent_phone, student_name, details } = body;

    if (!parent_phone || !student_name || !type) {
      return json({ error: "type, parent_phone, and student_name are required" }, 400);
    }

    let message = "";

    switch (type) {
      case "grade": {
        const { title, score, max_score, class_name } = details || {};
        const pct = score && max_score ? Math.round((score / max_score) * 100) : null;
        message = `📝 Grade Update for ${student_name}:\n${title || "Assignment"} — ${score ?? "N/A"}/${max_score ?? "N/A"}${pct ? ` (${pct}%)` : ""}\nClass: ${class_name || "N/A"}\n— UnityClass`;
        break;
      }
      case "absence": {
        const { class_name, date, status } = details || {};
        message = `⚠️ Attendance Alert for ${student_name}:\nStatus: ${(status || "absent").toUpperCase()}\nClass: ${class_name || "N/A"}\nDate: ${date || "today"}\n— UnityClass`;
        break;
      }
      default:
        return json({ error: `Unknown notification type: ${type}` }, 400);
    }

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
    console.error("notify-parent-sms error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
