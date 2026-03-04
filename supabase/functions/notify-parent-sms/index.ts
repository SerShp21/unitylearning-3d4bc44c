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
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      return json({ error: "Twilio credentials not configured" }, 500);
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
        message = `📝 Grade Update for ${student_name}: ${title || "Assignment"} — ${score ?? "N/A"}/${max_score ?? "N/A"} in ${class_name || "class"}. — UnityClass`;
        break;
      }
      case "absence": {
        const { class_name, date, status } = details || {};
        message = `⚠️ Attendance Alert for ${student_name}: Marked as ${status || "absent"} in ${class_name || "class"} on ${date || "today"}. — UnityClass`;
        break;
      }
      default:
        return json({ error: `Unknown notification type: ${type}` }, 400);
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const authStr = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const res = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authStr}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: TWILIO_PHONE_NUMBER,
        To: parent_phone,
        Body: message,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      console.error("Twilio error:", result);
      return json({ error: result.message || "Failed to send SMS" }, 500);
    }

    return json({ success: true, sid: result.sid });
  } catch (err) {
    console.error("notify-parent-sms error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
