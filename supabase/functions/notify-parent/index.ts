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
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY not configured" }, 500);

    const body = await req.json();
    const { type, parent_email, student_name, details } = body;

    if (!parent_email || !student_name || !type) {
      return json({ error: "type, parent_email, and student_name are required" }, 400);
    }

    let subject = "";
    let htmlBody = "";

    switch (type) {
      case "grade": {
        const { title, score, max_score, class_name } = details || {};
        subject = `Grade Update: ${student_name} - ${title || "New Grade"}`;
        htmlBody = `
          <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #4338ca; margin-bottom: 16px;">📝 Grade Notification</h2>
            <p>Dear Parent/Guardian,</p>
            <p>A new grade has been recorded for <strong>${student_name}</strong>:</p>
            <div style="background: #f4f4f5; border-radius: 12px; padding: 16px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Assignment:</strong> ${title || "N/A"}</p>
              <p style="margin: 4px 0;"><strong>Score:</strong> ${score ?? "N/A"} / ${max_score ?? "N/A"}</p>
              <p style="margin: 4px 0;"><strong>Class:</strong> ${class_name || "N/A"}</p>
            </div>
            <p style="color: #71717a; font-size: 14px;">— UnityClass</p>
          </div>`;
        break;
      }
      case "absence": {
        const { class_name, date, status } = details || {};
        subject = `Attendance Alert: ${student_name} - ${status || "Absent"}`;
        htmlBody = `
          <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #dc2626; margin-bottom: 16px;">⚠️ Attendance Alert</h2>
            <p>Dear Parent/Guardian,</p>
            <p>An attendance issue has been recorded for <strong>${student_name}</strong>:</p>
            <div style="background: #fef2f2; border-radius: 12px; padding: 16px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Status:</strong> ${status || "Absent"}</p>
              <p style="margin: 4px 0;"><strong>Class:</strong> ${class_name || "N/A"}</p>
              <p style="margin: 4px 0;"><strong>Date:</strong> ${date || "N/A"}</p>
            </div>
            <p style="color: #71717a; font-size: 14px;">— UnityClass</p>
          </div>`;
        break;
      }
      default:
        return json({ error: `Unknown notification type: ${type}` }, 400);
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "UnityClass <onboarding@resend.dev>",
        to: [parent_email],
        subject,
        html: htmlBody,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      console.error("Resend error:", result);
      return json({ error: result.message || "Failed to send email" }, 500);
    }

    return json({ success: true, id: result.id });
  } catch (err) {
    console.error("notify-parent error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
