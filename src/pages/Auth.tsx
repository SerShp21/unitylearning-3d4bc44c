import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import { FaceVerify } from "@/components/FaceVerify";

type Step = "credentials" | "face";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("credentials");
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const [pendingSession, setPendingSession] = useState<{ userId: string; accessToken: string } | null>(null);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Check if this user has a face_id enrolled
      const { data: profile } = await supabase
        .from("profiles")
        .select("face_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (profile?.face_id) {
        // Has face enrolled → require face verification
        // Sign out temporarily to block app access until face passes
        await supabase.auth.signOut();
        const descriptor = JSON.parse(profile.face_id) as number[];
        setFaceDescriptor(descriptor);
        setPendingSession({ userId: data.user.id, accessToken: "" });
        setStep("face");
      } else {
        // No face enrolled → proceed normally
        toast.success("Welcome back!");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFaceSuccess = async () => {
    // Face matched → sign back in
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Face verified! Welcome back!");
    } catch {
      toast.error("Could not complete sign in. Please try again.");
      setStep("credentials");
    }
  };

  const handleFaceSkip = () => {
    toast.error("Face verification required for this account. Please try again.");
    setStep("credentials");
    setFaceDescriptor(null);
    setPendingSession(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <GraduationCap className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">UnityClass</CardTitle>
          <CardDescription>
            {step === "credentials" ? "Sign in to your account" : "Step 2: Face Verification"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "credentials" ? (
            <form onSubmit={handleCredentials} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Contact your administrator to get an account.
              </p>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Your account has face verification enabled. Please look at your camera to confirm your identity.
              </p>
              {faceDescriptor && (
                <FaceVerify
                  storedDescriptor={faceDescriptor}
                  onSuccess={handleFaceSuccess}
                  onSkip={handleFaceSkip}
                  threshold={0.5}
                />
              )}
              <Button
                variant="ghost"
                className="w-full text-xs"
                onClick={() => {
                  setStep("credentials");
                  setFaceDescriptor(null);
                  setPendingSession(null);
                }}
              >
                ← Back to login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
