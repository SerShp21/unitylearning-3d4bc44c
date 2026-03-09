Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const url = new URL(req.url);
  const resource = url.searchParams.get("resource");
  const method = req.method;

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // JWT-authenticated admin endpoints
  if ((resource === "create_user" || resource === "invite_user") && method === "POST") {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user: caller }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !caller) return json({ error: "Unauthorized" }, 401);

    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", caller.id).maybeSingle();
    if (roleData?.role !== "super_admin") return json({ error: "Only super_admin can manage users" }, 403);

    const body = await req.json();

    // New invite flow — only requires email
    if (resource === "invite_user") {
      const { email } = body;
      if (!email) return json({ error: "email required" }, 400);

      const redirectTo = req.headers.get("origin") || "https://unitylearning.lovable.app";

      // Use generateLink to avoid triggering the email hook (which times out)
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo },
      });
      if (linkErr) return json({ error: linkErr.message }, 400);

      const inviteLink = linkData.properties.action_link;

      // Send the invite email via Resend
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) {
        console.error("RESEND_API_KEY not set");
        return json({ error: "Email service not configured" }, 500);
      }

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "UnityClass <onboarding@resend.dev>",
          to: [email],
          subject: "You're invited to UnityClass",
          html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#1a1a1a">Welcome to UnityClass!</h2>
            <p style="color:#555;line-height:1.6">You've been invited to join UnityClass. Click the button below to set up your account.</p>
            <a href="${inviteLink}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">Accept Invitation</a>
            <p style="color:#999;font-size:12px;margin-top:24px">If you didn't expect this, ignore this email.</p>
          </div>`,
        }),
      });

      const emailData = await emailRes.json();
      if (!emailRes.ok) {
        console.error("Resend error:", JSON.stringify(emailData));
        return json({ error: `Failed to send email: ${emailData.message || JSON.stringify(emailData)}` }, 500);
      }

      return json({ data: { id: linkData.user.id, email } }, 201);
    }

    // Legacy create_user (for backward compat / external API)
    const { email, password, full_name, role, face_id } = body;
    if (!email || !password) return json({ error: "email and password required" }, 400);

    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: full_name || "" },
    });
    if (createErr) return json({ error: createErr.message }, 400);

    if (face_id) await supabase.from("profiles").update({ face_id }).eq("user_id", newUser.user.id);
    if (role && role !== "student") await supabase.from("user_roles").update({ role }).eq("user_id", newUser.user.id);

    return json({ data: { id: newUser.user.id, email } }, 201);
  }

  // For all other endpoints, require API key
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("UNITYCLASS_API_KEY");
  if (!apiKey || apiKey !== expectedKey) {
    return json({ error: "Invalid or missing API key" }, 401);
  }

  const body = method !== "GET" ? await req.json().catch(() => ({})) : {};

  try {
    // ─── READ (GET) ───
    if (method === "GET") {
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
        case "grades": {
          const { data, error } = await supabase.from("grades").select("*, classes(name)");
          if (error) throw error;
          return json({ data });
        }
        case "attendance": {
          const { data, error } = await supabase.from("attendance").select("*, classes(name)");
          if (error) throw error;
          return json({ data });
        }
        case "lectures": {
          const { data, error } = await supabase.from("lectures").select("*, classes(name)");
          if (error) throw error;
          return json({ data });
        }
        default:
          return json({ error: "Missing or invalid 'resource' param", available: ["classes", "timetable", "users", "enrollments", "grades", "attendance", "lectures"] }, 400);
      }
    }

    // ─── CREATE (POST) ───
    if (method === "POST") {
      switch (resource) {
        case "classes": {
          const { name, subject, description, teacher_id } = body;
          if (!name) return json({ error: "name is required" }, 400);
          const { data, error } = await supabase.from("classes").insert({ name, subject: subject || "", description: description || "", teacher_id: teacher_id || null }).select().single();
          if (error) throw error;
          return json({ data }, 201);
        }
        case "timetable": {
          const { class_id, day_of_week, start_time, end_time, room } = body;
          if (!class_id || day_of_week === undefined || !start_time || !end_time) return json({ error: "class_id, day_of_week, start_time, end_time required" }, 400);
          const { data, error } = await supabase.from("timetable_entries").insert({ class_id, day_of_week, start_time, end_time, room: room || "" }).select().single();
          if (error) throw error;
          return json({ data }, 201);
        }
        case "enrollments": {
          const { class_id, student_id } = body;
          if (!class_id || !student_id) return json({ error: "class_id and student_id required" }, 400);
          const { data, error } = await supabase.from("class_enrollments").insert({ class_id, student_id }).select().single();
          if (error) throw error;
          return json({ data }, 201);
        }
        case "grades": {
          const { class_id, student_id, title, score, max_score, timetable_entry_id, notes, graded_by } = body;
          if (!class_id || !student_id || !title || score === undefined) return json({ error: "class_id, student_id, title, score required" }, 400);
          const { data, error } = await supabase.from("grades").insert({
            class_id, student_id, title, score, max_score: max_score ?? 100,
            timetable_entry_id: timetable_entry_id || null, notes: notes || null, graded_by: graded_by || null,
          }).select().single();
          if (error) throw error;
          return json({ data }, 201);
        }
        case "attendance": {
          const { class_id, student_id, date, status, timetable_entry_id, marked_by } = body;
          if (!class_id || !student_id) return json({ error: "class_id and student_id required" }, 400);
          const { data, error } = await supabase.from("attendance").insert({
            class_id, student_id, date: date || new Date().toISOString().split("T")[0],
            status: status || "present", timetable_entry_id: timetable_entry_id || null, marked_by: marked_by || null,
          }).select().single();
          if (error) throw error;
          return json({ data }, 201);
        }
        case "lectures": {
          const { class_id, title, file_url, file_name, file_type, uploaded_by } = body;
          if (!class_id || !title || !file_url || !file_name || !file_type || !uploaded_by) {
            return json({ error: "class_id, title, file_url, file_name, file_type, uploaded_by required" }, 400);
          }
          const { data, error } = await supabase.from("lectures").insert({
            class_id, title, file_url, file_name, file_type, uploaded_by,
          }).select().single();
          if (error) throw error;
          return json({ data }, 201);
        }
        default:
          return json({ error: "POST not supported for this resource" }, 400);
      }
    }

    // ─── UPDATE (PUT/PATCH) ───
    if (method === "PUT" || method === "PATCH") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "id query param required for update" }, 400);

      switch (resource) {
        case "classes": {
          const { data, error } = await supabase.from("classes").update(body).eq("id", id).select().single();
          if (error) throw error;
          return json({ data });
        }
        case "timetable": {
          const { data, error } = await supabase.from("timetable_entries").update(body).eq("id", id).select().single();
          if (error) throw error;
          return json({ data });
        }
        case "grades": {
          const { data, error } = await supabase.from("grades").update(body).eq("id", id).select().single();
          if (error) throw error;
          return json({ data });
        }
        case "attendance": {
          const { data, error } = await supabase.from("attendance").update(body).eq("id", id).select().single();
          if (error) throw error;
          return json({ data });
        }
        case "profiles": {
          const { data, error } = await supabase.from("profiles").update(body).eq("user_id", id).select().single();
          if (error) throw error;
          return json({ data });
        }
        case "user_roles": {
          const { data, error } = await supabase.from("user_roles").update(body).eq("user_id", id).select().single();
          if (error) throw error;
          return json({ data });
        }
        case "enrollments": {
          const { data, error } = await supabase.from("class_enrollments").update(body).eq("id", id).select().single();
          if (error) throw error;
          return json({ data });
        }
        case "lectures": {
          const { data, error } = await supabase.from("lectures").update(body).eq("id", id).select().single();
          if (error) throw error;
          return json({ data });
        }
        default:
          return json({ error: "PUT/PATCH not supported for this resource" }, 400);
      }
    }

    // ─── DELETE ───
    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      const studentId = url.searchParams.get("student_id");

      switch (resource) {
        case "classes": {
          if (!id) return json({ error: "id required" }, 400);
          const { error } = await supabase.from("classes").delete().eq("id", id);
          if (error) throw error;
          return json({ success: true });
        }
        case "timetable": {
          if (!id) return json({ error: "id required" }, 400);
          const { error } = await supabase.from("timetable_entries").delete().eq("id", id);
          if (error) throw error;
          return json({ success: true });
        }
        case "enrollments": {
          if (id) {
            const { error } = await supabase.from("class_enrollments").delete().eq("id", id);
            if (error) throw error;
          } else if (studentId) {
            const { error } = await supabase.from("class_enrollments").delete().eq("student_id", studentId);
            if (error) throw error;
          } else {
            return json({ error: "id or student_id required" }, 400);
          }
          return json({ success: true });
        }
        case "grades": {
          if (!id) return json({ error: "id required" }, 400);
          const { error } = await supabase.from("grades").delete().eq("id", id);
          if (error) throw error;
          return json({ success: true });
        }
        case "attendance": {
          if (!id) return json({ error: "id required" }, 400);
          const { error } = await supabase.from("attendance").delete().eq("id", id);
          if (error) throw error;
          return json({ success: true });
        }
        case "lectures": {
          if (!id) return json({ error: "id required" }, 400);
          const { error } = await supabase.from("lectures").delete().eq("id", id);
          if (error) throw error;
          return json({ success: true });
        }
        case "users": {
          if (!id) return json({ error: "id (user_id) required" }, 400);
          await supabase.from("class_enrollments").delete().eq("student_id", id);
          await supabase.from("attendance").delete().eq("student_id", id);
          await supabase.from("grades").delete().eq("student_id", id);
          await supabase.from("lectures").delete().eq("uploaded_by", id);
          await supabase.from("user_roles").delete().eq("user_id", id);
          await supabase.from("profiles").delete().eq("user_id", id);
          const { error } = await supabase.auth.admin.deleteUser(id);
          if (error) throw error;
          return json({ success: true });
        }
        default:
          return json({ error: "DELETE not supported for this resource" }, 400);
      }
    }

    return json({ error: "Method not supported" }, 405);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
