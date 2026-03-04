import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FaceCapture } from "@/components/FaceCapture";
import { toast } from "sonner";
import { GraduationCap, CheckCircle2 } from "lucide-react";

const Onboarding = () => {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (!faceDescriptor) {
      toast.error("Face ID is required. Please capture your face.");
      return;
    }

    setSaving(true);
    try {
      // Set the user's password
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) throw pwErr;

      // Update profile with all info
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          gender,
          parent_email: parentEmail.trim(),
          parent_phone: parentPhone.trim() || null,
          face_id: JSON.stringify(faceDescriptor),
          setup_completed: true,
        } as any)
        .eq("user_id", user.id);

      if (profileErr) throw profileErr;

      toast.success("Account setup complete! Welcome to UnityClass!");
      window.location.href = "/";
    } catch (err: any) {
      toast.error(err.message || "Failed to complete setup");
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
          <CardTitle className="text-2xl">Complete Your Account</CardTitle>
          <CardDescription>
            Fill in your details to finish setting up your UnityClass account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Your full name"
                required
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender} required>
                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="parentEmail">Parent Email</Label>
              <Input
                id="parentEmail"
                type="email"
                value={parentEmail}
                onChange={e => setParentEmail(e.target.value)}
                placeholder="parent@example.com"
                required
                maxLength={255}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parentPhone">Parent Phone Number (for SMS alerts)</Label>
              <Input
                id="parentPhone"
                type="tel"
                value={parentPhone}
                onChange={e => setParentPhone(e.target.value)}
                placeholder="+1234567890"
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">Include country code (e.g. +1 for US). Optional.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Set Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                required
                minLength={6}
              />
            </div>

            {/* Face ID capture */}
            <div className="space-y-2 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <Label>Face ID (required)</Label>
                {faceDescriptor && (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Captured
                  </span>
                )}
              </div>
              {!faceDescriptor ? (
                <FaceCapture
                  label="Capture Face"
                  onCapture={desc => setFaceDescriptor(desc)}
                />
              ) : (
                <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                  <span className="text-sm text-muted-foreground">Face descriptor stored (128 points)</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setFaceDescriptor(null)}>Retake</Button>
                </div>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={saving || !gender || !faceDescriptor}>
              {saving ? "Setting up..." : "Complete Setup"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
