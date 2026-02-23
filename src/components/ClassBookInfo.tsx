import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BookOpen, Camera, X, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ClassBookInfoProps {
  classId: string;
  bookTitle: string | null;
  bookAuthor: string | null;
  bookCoverUrl: string | null;
  bookPublisher: string | null;
  bookEbookUrl: string | null;
  canEdit: boolean;
}

export const ClassBookInfo = ({
  classId, bookTitle, bookAuthor, bookCoverUrl, bookPublisher, bookEbookUrl, canEdit,
}: ClassBookInfoProps) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      toast.error("Could not access camera. Try uploading a photo instead.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(dataUrl);
    stopCamera();
  }, [stopCamera]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCapturedImage(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const analyzeAndSave = async () => {
    if (!capturedImage) return;
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-book-cover", {
        body: { image_base64: capturedImage, class_id: classId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success(`Book "${data.book.title}" linked!`);
      setOpen(false);
      setCapturedImage(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to analyze book cover");
    } finally {
      setAnalyzing(false);
    }
  };

  const removeBook = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("classes").update({
        book_title: null, book_author: null, book_cover_url: null,
        book_publisher: null, book_ebook_url: null, book_isbn: null,
      } as any).eq("id", classId);
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

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) { stopCamera(); setCapturedImage(null); }
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
          {bookPublisher && <p className="text-[11px] text-muted-foreground truncate">{bookPublisher}</p>}
        </div>
        {bookEbookUrl && (
          <a href={bookEbookUrl} target="_blank" rel="noopener noreferrer"
            className="shrink-0 text-primary hover:text-primary/80">
            <FileText className="h-4 w-4" />
          </a>
        )}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full mt-1 gap-1.5">
          <BookOpen className="h-3.5 w-3.5" />
          {bookTitle ? bookTitle : "Link Textbook"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Link Textbook via Photo</DialogTitle>
        </DialogHeader>

        {/* Current book display */}
        {bookTitle && !capturedImage && (
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
              {bookPublisher && <p className="text-xs text-muted-foreground truncate">{bookPublisher}</p>}
              {bookEbookUrl && (
                <a href={bookEbookUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
                  <FileText className="h-3 w-3" /> View E-Book
                </a>
              )}
            </div>
            <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive shrink-0 h-8 w-8"
              onClick={removeBook} disabled={saving}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Camera / captured image view */}
        {capturedImage ? (
          <div className="space-y-3">
            <img src={capturedImage} alt="Captured cover" className="w-full rounded-lg shadow-sm" />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCapturedImage(null)} disabled={analyzing}>
                Retake
              </Button>
              <Button className="flex-1" onClick={analyzeAndSave} disabled={analyzing}>
                {analyzing ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Analyzing...</> : "Analyze & Save"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Live camera preview */}
            <div className="relative bg-black rounded-lg overflow-hidden aspect-[4/3]">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay
                onLoadedMetadata={() => videoRef.current?.play()} />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-white/30 rounded-lg w-3/4 h-3/4" />
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={startCamera}>
                <Camera className="h-4 w-4 mr-2" /> Start Camera
              </Button>
              <Button variant="outline" className="flex-1" onClick={capturePhoto}>
                Capture
              </Button>
            </div>

            <div className="relative flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
              Upload Photo
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
