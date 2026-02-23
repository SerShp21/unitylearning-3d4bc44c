import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { image_base64, class_id } = await req.json();
    if (!image_base64 || !class_id) {
      return new Response(JSON.stringify({ error: "image_base64 and class_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Analyze the book cover with AI vision
    const analysisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this book cover image. Extract the following information and return it using the extract_book_info tool. If you can't determine a field, use "Unknown".`,
              },
              {
                type: "image_url",
                image_url: { url: image_base64 },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_book_info",
              description: "Extract book metadata from a cover image",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "The book title" },
                  author: { type: "string", description: "The author name" },
                  publisher: { type: "string", description: "The publisher name" },
                },
                required: ["title", "author", "publisher"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_book_info" } },
      }),
    });

    if (!analysisResponse.ok) {
      if (analysisResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (analysisResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await analysisResponse.text();
      console.error("AI analysis error:", analysisResponse.status, t);
      throw new Error("Failed to analyze book cover");
    }

    const analysisData = await analysisResponse.json();
    const toolCall = analysisData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return structured data");

    const bookInfo = JSON.parse(toolCall.function.arguments);
    console.log("Extracted book info:", bookInfo);

    // Step 2: Generate an e-book summary/study guide
    const ebookResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You are an educational content creator. Create a comprehensive study guide e-book in Markdown format.",
          },
          {
            role: "user",
            content: `Create a detailed study guide/e-book for the book "${bookInfo.title}" by ${bookInfo.author} (published by ${bookInfo.publisher}). Include:

1. **Book Overview** - A thorough summary of the book
2. **Key Themes & Concepts** - Major themes explored
3. **Chapter-by-Chapter Summary** - Brief summary of main sections/chapters
4. **Key Vocabulary & Terms** - Important terms students should know
5. **Discussion Questions** - 10 thought-provoking questions
6. **Study Tips** - How to effectively study this material
7. **Further Reading** - Related books and resources

Format it as a clean, well-structured Markdown document suitable for students.`,
          },
        ],
      }),
    });

    let ebookContent = "";
    if (ebookResponse.ok) {
      const ebookData = await ebookResponse.json();
      ebookContent = ebookData.choices?.[0]?.message?.content || "";
    } else {
      console.error("E-book generation failed:", ebookResponse.status);
      ebookContent = `# Study Guide: ${bookInfo.title}\n\nBy ${bookInfo.author}\nPublisher: ${bookInfo.publisher}\n\n*E-book content generation failed. Please try again.*`;
    }

    // Step 3: Upload cover image and e-book to storage
    const authHeader = req.headers.get("authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader! } } }
    );

    // Upload cover image
    const imageData = image_base64.split(",")[1] || image_base64;
    const imageBytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));
    const coverPath = `${class_id}/cover-${Date.now()}.jpg`;
    const { error: coverErr } = await supabase.storage
      .from("book-covers")
      .upload(coverPath, imageBytes, { contentType: "image/jpeg", upsert: true });
    
    let coverUrl = "";
    if (!coverErr) {
      const { data: urlData } = supabase.storage.from("book-covers").getPublicUrl(coverPath);
      coverUrl = urlData.publicUrl;
    } else {
      console.error("Cover upload error:", coverErr);
    }

    // Upload e-book as markdown file
    const ebookPath = `${class_id}/ebook-${Date.now()}.md`;
    const ebookBytes = new TextEncoder().encode(ebookContent);
    const { error: ebookErr } = await supabase.storage
      .from("book-covers")
      .upload(ebookPath, ebookBytes, { contentType: "text/markdown", upsert: true });

    let ebookUrl = "";
    if (!ebookErr) {
      const { data: urlData } = supabase.storage.from("book-covers").getPublicUrl(ebookPath);
      ebookUrl = urlData.publicUrl;
    } else {
      console.error("E-book upload error:", ebookErr);
    }

    // Step 4: Update the class record
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: updateErr } = await serviceClient.from("classes").update({
      book_title: bookInfo.title,
      book_author: bookInfo.author,
      book_publisher: bookInfo.publisher,
      book_cover_url: coverUrl,
      book_ebook_url: ebookUrl,
      book_isbn: null,
    }).eq("id", class_id);

    if (updateErr) {
      console.error("Class update error:", updateErr);
      throw new Error("Failed to save book info to class");
    }

    return new Response(JSON.stringify({
      success: true,
      book: {
        title: bookInfo.title,
        author: bookInfo.author,
        publisher: bookInfo.publisher,
        cover_url: coverUrl,
        ebook_url: ebookUrl,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-book-cover error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
