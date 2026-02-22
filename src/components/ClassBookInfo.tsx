import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { BookOpen, ScanBarcode, Search, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface BookData {
  isbn: string;
  title: string;
  author: string;
  cover_url: string;
}

interface ClassBookInfoProps {
  classId: string;
  bookIsbn: string | null;
  bookTitle: string | null;
  bookAuthor: string | null;
  bookCoverUrl: string | null;
  canEdit: boolean;
}

const cleanISBN = (raw: string): string => raw.replace(/[-\s]/g, "");

const fetchBookByISBN = async (isbn: string): Promise<BookData | null> => {
  const cleaned = cleanISBN(isbn);
  if (!cleaned || cleaned.length < 10) return null;

  // Try Open Library books API (most reliable)
  try {
    const res = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${cleaned}&format=json&jscmd=data`,
      { headers: { Accept: "application/json" } }
    );
    if (res.ok) {
      const data = await res.json();
      const key = `ISBN:${cleaned}`;
      if (data[key]) {
        const book = data[key];
        return {
          isbn: cleaned,
          title: book.title || "Unknown Title",
          author: book.authors?.[0]?.name || "Unknown Author",
          cover_url: book.cover?.medium || book.cover?.small || "",
        };
      }
    }
  } catch { /* fall through */ }

  // Fallback: ISBN endpoint
  try {
    const res = await fetch(`https://openlibrary.org/isbn/${cleaned}.json`, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      let author = "Unknown Author";
      if (data.authors?.length) {
        try {
          const authorRes = await fetch(`https://openlibrary.org${data.authors[0].key}.json`);
          if (authorRes.ok) {
            const authorData = await authorRes.json();
            author = authorData.name || author;
          }
        } catch { /* use default */ }
      }
      const coverId = data.covers?.[0];
      return {
        isbn: cleaned,
        title: data.title || "Unknown Title",
        author,
        cover_url: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : "",
      };
    }
  } catch { /* fall through */ }

  return null;
};

export const ClassBookInfo = ({ classId, bookIsbn, bookTitle, bookAuthor, bookCoverUrl, canEdit }: ClassBookInfoProps) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [manualIsbn, setManualIsbn] = useState("");
  const [preview, setPreview] = useState<BookData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const lookupISBN = useCallback(async (isbn: string) => {
    const cleaned = cleanISBN(isbn);
    if (!cleaned) {
      toast.error("Please enter a valid ISBN");
      return;
    }
    setLoading(true);
    setScanning(false);
    try {
      const book = await fetchBookByISBN(cleaned);
      if (!book) {
        toast.error("Book not found for that ISBN. Check the number and try again.");
        return;
      }
      setPreview(book);
    } catch {
      toast.error("Failed to fetch book info. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  const saveBook = async (book: BookData) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("classes").update({
        book_isbn: book.isbn,
        book_title: book.title,
        book_author: book.author,
        book_cover_url: book.cover_url,
      }).eq("id", classId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Book linked to class!");
      setOpen(false);
      setPreview(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const removeBook = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("classes").update({
        book_isbn: null, book_title: null, book_author: null, book_cover_url: null,
      }).eq("id", classId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Book removed");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Read-only display for students
  if (!canEdit) {
    if (!bookTitle) return null;
    return (
      <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 mt-1">
        {bookCoverUrl ? (
          <img src={bookCoverUrl} alt="cover" className="h-12 w-9 object-cover rounded shadow-sm" />
        ) : (
          <div className="h-12 w-9 rounded bg-muted flex items-center justify-center">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-xs truncate">{bookTitle}</p>
          <p className="text-[11px] text-muted-foreground truncate">{bookAuthor}</p>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setPreview(null); setScanning(false); setManualIsbn(""); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full mt-1 gap-1.5">
          <BookOpen className="h-3.5 w-3.5" />
          {bookTitle ? bookTitle : "Link Textbook"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Link Textbook via Barcode</DialogTitle>
        </DialogHeader>

        {/* Current book display */}
        {bookTitle && !preview && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 mb-2">
            {bookCoverUrl ? (
              <img src={bookCoverUrl} alt="cover" className="h-16 w-12 object-cover rounded-lg shadow-sm" />
            ) : (
              <div className="h-16 w-12 rounded-lg bg-muted flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{bookTitle}</p>
              <p className="text-xs text-muted-foreground truncate">{bookAuthor}</p>
              <p className="text-xs text-muted-foreground font-mono">{bookIsbn}</p>
            </div>
            <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive shrink-0 h-8 w-8" onClick={removeBook} disabled={saving}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Preview after scan/search */}
        {preview && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 mb-2">
            {preview.cover_url ? (
              <img src={preview.cover_url} alt="cover" className="h-16 w-12 object-cover rounded-lg shadow-sm" />
            ) : (
              <div className="h-16 w-12 rounded-lg bg-muted flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{preview.title}</p>
              <p className="text-xs text-muted-foreground truncate">{preview.author}</p>
              <p className="text-xs text-muted-foreground font-mono">{preview.isbn}</p>
            </div>
          </div>
        )}

        {preview ? (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setPreview(null)}>Back</Button>
            <Button className="flex-1" onClick={() => saveBook(preview)} disabled={saving}>{saving ? "Saving..." : "Link Book"}</Button>
          </div>
        ) : scanning ? (
          <BarcodeScanner onScan={isbn => lookupISBN(isbn)} onClose={() => setScanning(false)} />
        ) : (
          <div className="space-y-3">
            <Button className="w-full" onClick={() => setScanning(true)}>
              <ScanBarcode className="h-4 w-4 mr-2" /> Scan Barcode
            </Button>
            <div className="relative flex items-center gap-2">
              <div className="flex-1 h-px bg-border" /><span className="text-xs text-muted-foreground">or</span><div className="flex-1 h-px bg-border" />
            </div>
            <div className="flex gap-2">
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Enter ISBN manually</Label>
                <Input placeholder="978-0-000-00000-0" value={manualIsbn} onChange={e => setManualIsbn(e.target.value)} onKeyDown={e => e.key === "Enter" && lookupISBN(manualIsbn)} />
              </div>
              <Button variant="outline" className="self-end" onClick={() => lookupISBN(manualIsbn)} disabled={!manualIsbn || loading}>
                {loading ? "..." : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
