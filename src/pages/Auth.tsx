import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { GraduationCap, ScanFace, ShieldCheck } from "lucide-react";
import { FaceVerify } from "@/components/FaceVerify";

type Step = "credentials" | "face";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("credentials");
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);

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
        // Has face enrolled → sign out and require face verification as step 2
        await supabase.auth.signOut();
        const descriptor = JSON.parse(profile.face_id) as number[];
        setFaceDescriptor(descriptor);
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
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Identity verified! Welcome back!");
    } catch {
      toast.error("Could not complete sign in. Please try again.");
      backToCredentials();
    }
  };

  const backToCredentials = () => {
    setStep("credentials");
    setFaceDescriptor(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            {step === "face" ? (
              <ScanFace className="h-7 w-7 text-primary-foreground" />
            ) : (
              <GraduationCap className="h-7 w-7 text-primary-foreground" />
            )}
          </div>
          <CardTitle className="text-2xl">UnityClass</CardTitle>

          {step === "credentials" ? (
            <CardDescription>Sign in to your account</CardDescription>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2 text-sm font-medium">
                <span className="flex items-center gap-1 text-muted-foreground line-through">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-bold">1</span>
                  Credentials
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="flex items-center gap-1 text-primary font-semibold">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                  Face ID
                </span>
              </div>
              <CardDescription>Look at your camera to verify your identity</CardDescription>
            </div>
          )}
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
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 flex items-start gap-3">
                <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Your account requires Face ID verification. Please look directly at your camera to confirm your identity.
                </p>
              </div>

              {faceDescriptor && (
                <FaceVerify
                  storedDescriptor={faceDescriptor}
                  onSuccess={handleFaceSuccess}
                  onSkip={() => {
                    toast.error("Face verification is required. Please try again.");
                    backToCredentials();
                  }}
                  threshold={0.5}
                />
              )}

              <Button
                variant="ghost"
                className="w-full text-xs text-muted-foreground"
                onClick={backToCredentials}
              >
                ← Use a different account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
