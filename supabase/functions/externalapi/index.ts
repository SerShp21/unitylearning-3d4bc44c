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
  const method = req.method;

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

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
        default:
          return json({ error: "Missing or invalid 'resource' param", available: ["classes", "timetable", "users", "enrollments", "grades", "attendance"] }, 400);
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
            // Expel: remove student from all classes
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
        default:
          return json({ error: "DELETE not supported for this resource" }, 400);
      }
    }

    return json({ error: "Method not supported" }, 405);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
