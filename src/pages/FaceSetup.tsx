import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FaceCapture } from "@/components/FaceCapture";
import { GraduationCap } from "lucide-react";
import { toast } from "sonner";

const FaceSetup = () => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const handleCapture = async (descriptor: number[]) => {
    if (!user) return;
    setSaving(true);
    try {
      // Check if profile exists
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      let error;
      if (existing) {
        ({ error } = await supabase
          .from("profiles")
          .update({ face_id: JSON.stringify(descriptor) })
          .eq("user_id", user.id));
      } else {
        ({ error } = await supabase
          .from("profiles")
          .insert({
            user_id: user.id,
            full_name: user.email?.split("@")[0] ?? "User",
            face_id: JSON.stringify(descriptor),
          }));
      }

      if (error) throw error;
      toast.success("Face ID set up successfully!");
      window.location.href = "/";
    } catch (err: any) {
      toast.error(err.message || "Failed to save Face ID");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg shadow-xl border-0">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <GraduationCap className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Set Up Face ID</CardTitle>
          <CardDescription>
            For security, all users must enroll their face. This is a one-time setup.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          {saving ? (
            <p className="text-sm text-muted-foreground">Saving your Face ID...</p>
          ) : (
            <FaceCapture onCapture={handleCapture} label="Enroll Face" />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FaceSetup;
