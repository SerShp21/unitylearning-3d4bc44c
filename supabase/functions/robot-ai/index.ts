import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { action, topic, class_name, book_info, num_questions } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const callAI = async (messages: any[], tools?: any[], tool_choice?: any) => {
      const body: any = { model: "google/gemini-3-flash-preview", messages };
      if (tools) body.tools = tools;
      if (tool_choice) body.tool_choice = tool_choice;

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const t = await resp.text();
        console.error("AI gateway error:", resp.status, t);
        if (resp.status === 429) return { error: "Rate limited, please try again later", status: 429 };
        if (resp.status === 402) return { error: "AI credits exhausted, please add credits", status: 402 };
        return { error: "AI request failed", status: 500 };
      }
      return { data: await resp.json(), status: 200 };
    };

    // ─── GENERATE QUIZ ───
    if (action === "generate_quiz") {
      const prompt = `Generate exactly ${num_questions || 5} multiple-choice quiz questions about "${topic}" for a class called "${class_name}".
${book_info?.title ? `The class textbook is: "${book_info.title}" by ${book_info.author || "Unknown"}. Use content relevant to this textbook.` : ""}
Each question must have exactly 4 options with one correct answer. Make them engaging, educational, and Kahoot-style (fun but rigorous).`;

      const result = await callAI(
        [
          { role: "system", content: "You are a quiz generator for educational purposes. Return structured quiz data using the provided tool." },
          { role: "user", content: prompt },
        ],
        [{
          type: "function",
          function: {
            name: "create_quiz",
            description: "Create multiple-choice quiz questions",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string" },
                      options: { type: "array", items: { type: "string" } },
                      correct_index: { type: "number", description: "0-based index of the correct option" },
                    },
                    required: ["question", "options", "correct_index"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        }],
        { type: "function", function: { name: "create_quiz" } }
      );

      if (result.error) return json({ error: result.error }, result.status);

      const toolCall = result.data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) return json({ error: "AI did not return quiz data" }, 500);
      const quiz = JSON.parse(toolCall.function.arguments);
      return json(quiz);
    }

    // ─── GENERATE LECTURE NOTES ───
    if (action === "generate_lecture") {
      const prompt = `Create comprehensive lecture notes about "${topic}" for the class "${class_name}".
${book_info?.title ? `Reference textbook: "${book_info.title}" by ${book_info.author || "Unknown"} (Publisher: ${book_info.publisher || "N/A"}).` : ""}

Generate a well-structured HTML document with inline styles. Include:
- A centered title header with date
- Learning objectives
- Key concepts with clear explanations
- Important definitions
- Examples where appropriate
- A concise summary at the end

Use professional styling with a clean font, proper margins, and good readability. Return ONLY the HTML, no markdown fences.`;

      const result = await callAI([
        { role: "system", content: "You are an educational content creator. Generate well-structured, professionally styled HTML lecture notes. Return ONLY raw HTML content." },
        { role: "user", content: prompt },
      ]);

      if (result.error) return json({ error: result.error }, result.status);

      let html = result.data.choices?.[0]?.message?.content || "";
      // Strip markdown code fences if present
      html = html.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();
      return json({ html });
    }

    return json({ error: "Unknown action. Use 'generate_quiz' or 'generate_lecture'." }, 400);
  } catch (e) {
    console.error("robot-ai error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
