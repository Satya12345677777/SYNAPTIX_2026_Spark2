import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getProfile, getWallet, isAdmin } from "@/lib/auth";

interface Profile {
  id: string;
  user_id: string;
  phone: string;
  display_name: string | null;
  payment_id: string;
  pin_hash: string;
  device_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  offline_daily_limit: number;
  offline_used_today: number;
  last_offline_reset: string;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  wallet: Wallet | null;
  isAdmin: boolean;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  refreshWallet: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserData = async (userId: string) => {
    try {
      const [profileData, walletData, adminStatus] = await Promise.all([
        getProfile(userId),
        getWallet(userId),
        isAdmin(userId),
      ]);
      setProfile(profileData as Profile);
      setWallet(walletData as Wallet);
      setIsAdminUser(adminStatus);
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      try {
        const profileData = await getProfile(user.id);
        setProfile(profileData as Profile);
      } catch (error) {
        console.error("Error refreshing profile:", error);
      }
    }
  };

  const refreshWallet = async () => {
    if (user) {
      try {
        const walletData = await getWallet(user.id);
        setWallet(walletData as Wallet);
      } catch (error) {
        console.error("Error refreshing wallet:", error);
      }
    }
  };

  useEffect(() => {
    // Set up auth state listener BEFORE getting initial session
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Use setTimeout to prevent potential deadlock
        setTimeout(() => loadUserData(newSession.user.id), 0);
      } else {
        setProfile(null);
        setWallet(null);
        setIsAdminUser(false);
      }
      setIsLoading(false);
    });

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        loadUserData(initialSession.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        wallet,
        isAdmin: isAdminUser,
        isLoading,
        refreshProfile,
        refreshWallet,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
