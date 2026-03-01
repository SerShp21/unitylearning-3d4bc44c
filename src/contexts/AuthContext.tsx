import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

type AppRole = Enums<"app_role">;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  profile: { full_name: string; avatar_url: string | null } | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  hasFaceId: boolean;
  setupCompleted: boolean;
  faceVerificationPending: boolean;
  setFaceVerificationPending: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null, user: null, role: null, profile: null,
  loading: true, signOut: async () => {}, isAdmin: false, isSuperAdmin: false, hasFaceId: false,
  setupCompleted: true,
  faceVerificationPending: false, setFaceVerificationPending: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; avatar_url: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasFaceId, setHasFaceId] = useState(false);
  const [setupCompleted, setSetupCompleted] = useState(true);
  const [faceVerificationPending, setFaceVerificationPending] = useState(false);

  const fetchUserData = async (userId: string) => {
    try {
      const [{ data: roleData }, { data: profileData }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
        supabase.from("profiles").select("full_name, avatar_url, face_id, setup_completed").eq("user_id", userId).maybeSingle(),
      ]);
      setRole(roleData?.role ?? "student");
      if (profileData) {
        setProfile({ full_name: profileData.full_name, avatar_url: profileData.avatar_url });
        setHasFaceId(!!profileData.face_id);
        setSetupCompleted(!!(profileData as any).setup_completed);
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
      setRole("student");
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(async () => {
          if (!mounted) return;
          await fetchUserData(session.user.id);
          if (mounted) setLoading(false);
        }, 0);
      } else {
        setRole(null);
        setProfile(null);
        setHasFaceId(false);
        setSetupCompleted(true);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
    setProfile(null);
  };

  const isAdmin = role === "admin" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";

  return (
    <AuthContext.Provider value={{
      session, user, role, profile, loading, signOut,
      isAdmin, isSuperAdmin, hasFaceId, setupCompleted,
      faceVerificationPending, setFaceVerificationPending,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
