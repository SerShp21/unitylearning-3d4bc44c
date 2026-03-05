import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Users, CheckCircle2, AlertCircle } from "lucide-react";

const ParentSignup = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [invite, setInvite] = useState<any>(null);
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    (async () => {
      const { data: inv } = await supabase
        .from("parent_invites")
        .select("*")
        .eq("token", token)
        .eq("status", "pending")
        .maybeSingle();
      
      if (inv) {
        setInvite(inv);
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", inv.student_id)
          .maybeSingle();
        setStudentName(profile?.full_name || "your child");
      }
      setLoading(false);
    })();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error("Passwords do not match"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }

    setSaving(true);
    try {
      // Create account
      const { data: signupData, error: signupErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (signupErr) throw signupErr;
      if (!signupData.user) throw new Error("Failed to create account");

      const userId = signupData.user.id;

      // Update profile
      await supabase.from("profiles").update({
        full_name: fullName,
        setup_completed: true,
      } as any).eq("user_id", userId);

      // Set role to parent
      await supabase.from("user_roles").update({ role: "parent" } as any).eq("user_id", userId);

      // Link: set parent_email on student's profile
      await supabase.from("profiles").update({ parent_email: email } as any).eq("user_id", invite.student_id);

      // Mark invite as accepted
      await supabase.from("parent_invites").update({
        status: "accepted",
        parent_user_id: userId,
        accepted_at: new Date().toISOString(),
      } as any).eq("id", invite.id);

      setDone(true);
      toast.success("Account created! Please verify your email, then sign in.");
    } catch (err: any) {
      toast.error(err.message || "Failed to create account");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!token || !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardContent className="flex flex-col items-center py-12 space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <h2 className="text-xl font-semibold">Invalid or Expired Invite</h2>
            <p className="text-muted-foreground text-center text-sm">
              This invite link is no longer valid. Please ask your child to resend the invitation from their UnityClass account.
            </p>
            <Button variant="outline" onClick={() => navigate("/auth")}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardContent className="flex flex-col items-center py-12 space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <h2 className="text-xl font-semibold">Account Created!</h2>
            <p className="text-muted-foreground text-center text-sm">
              Check your email to verify your account, then sign in to view {studentName}'s progress.
            </p>
            <Button onClick={() => navigate("/auth")}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Users className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Parent Account</CardTitle>
          <CardDescription>
            Create your account to monitor <strong>{studentName}</strong>'s grades, attendance, and more.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Your Full Name</Label>
              <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="parent@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Creating account..." : "Create Parent Account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ParentSignup;
