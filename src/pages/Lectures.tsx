import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, FileText, Image, File, Trash2, Download, BookOpen } from "lucide-react";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const fileIcon = (type: string) => {
  if (type.startsWith("image/")) return <Image className="h-5 w-5 text-primary" />;
  if (type.includes("pdf")) return <FileText className="h-5 w-5 text-destructive" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
};

const Lectures = () => {
  const { user, role, isAdmin } = useAuth();
  const canUpload = isAdmin || role === "teacher";
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("id, name").order("name");
      return data ?? [];
    },
  });

  const { data: lectures = [] } = useQuery({
    queryKey: ["lectures"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lectures")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data ?? [];
    },
  });

  const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p.full_name]));
  const classMap = Object.fromEntries(classes.map(c => [c.id, c.name]));

  const handleUpload = async () => {
    if (!file || !title || !classId) {
      toast.error("Please fill in all fields and select a file.");
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Only PDF, DOCX, and image files are allowed.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${classId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("lectures").upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("lectures").getPublicUrl(path);

      const { error: insertError } = await supabase.from("lectures").insert({
        class_id: classId,
        title,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_type: file.type,
        uploaded_by: user!.id,
      });
      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["lectures"] });
      toast.success("Lecture uploaded!");
      setOpen(false);
      setTitle("");
      setClassId("");
      setFile(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const deleteLecture = useMutation({
    mutationFn: async (lecture: { id: string; file_url: string }) => {
      // Extract storage path from URL
      const url = new URL(lecture.file_url);
      const pathParts = url.pathname.split("/storage/v1/object/public/lectures/");
      if (pathParts[1]) {
        await supabase.storage.from("lectures").remove([decodeURIComponent(pathParts[1])]);
      }
      const { error } = await supabase.from("lectures").delete().eq("id", lecture.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lectures"] });
      toast.success("Lecture deleted!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Lectures</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {canUpload ? "Upload and manage lecture materials" : "Access lecture materials"}
          </p>
        </div>
        {canUpload && (
          <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setFile(null); setTitle(""); setClassId(""); } }}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto gap-2 shadow-sm">
                <Upload className="h-4 w-4" /> Upload Lecture
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md">
              <DialogHeader><DialogTitle>Upload Lecture</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Chapter 5 – Photosynthesis" />
                </div>
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select value={classId} onValueChange={setClassId}>
                    <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>File (PDF, DOCX, or Image)</Label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={e => setFile(e.target.files?.[0] ?? null)}
                  />
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    {file ? file.name : "Choose file..."}
                  </Button>
                </div>
                <Button className="w-full" onClick={handleUpload} disabled={uploading || !file || !title || !classId}>
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {lectures.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-10 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium mb-1">No lectures yet</p>
            <p className="text-sm text-muted-foreground">{canUpload ? "Upload your first lecture to get started." : "No lectures have been uploaded yet."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {lectures.map(lec => (
            <Card key={lec.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="flex items-center gap-3 p-3 sm:p-4">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  {fileIcon(lec.file_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{lec.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {classMap[lec.class_id] || "Unknown class"} · {profileMap[lec.uploaded_by] || "Unknown"} · {new Date(lec.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <a href={lec.file_url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  {canUpload && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => { if (confirm("Delete this lecture?")) deleteLecture.mutate({ id: lec.id, file_url: lec.file_url }); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Lectures;
