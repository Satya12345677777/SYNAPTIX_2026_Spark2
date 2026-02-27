import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Simple hash function for PIN (in production, use bcrypt on server)
export function hashPin(pin: string): string {
  let hash = 0;
  const str = pin + "offlinepay-salt-v1";
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, "0");
}

export function verifyPin(pin: string, hash: string): boolean {
  return hashPin(pin) === hash;
}

// Generate a mock OTP (in production, send real SMS)
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Store OTP temporarily (in production, use server-side storage with expiry)
const otpStore = new Map<string, { otp: string; expires: number }>();

export function storeOTP(phone: string, otp: string): void {
  otpStore.set(phone, {
    otp,
    expires: Date.now() + 5 * 60 * 1000, // 5 minutes
  });
}

export function verifyOTP(phone: string, otp: string): boolean {
  const stored = otpStore.get(phone);
  if (!stored) return false;
  if (Date.now() > stored.expires) {
    otpStore.delete(phone);
    return false;
  }
  const isValid = stored.otp === otp;
  if (isValid) {
    otpStore.delete(phone);
  }
  return isValid;
}

// Generate unique payment ID
export function generatePaymentId(): string {
  const prefix = "OP";
  const randomNum = Math.floor(Math.random() * 100000000)
    .toString()
    .padStart(8, "0");
  return `${prefix}${randomNum}`;
}

interface SignUpData {
  phone: string;
  pin: string;
  displayName?: string;
}

export async function signUp({ phone, pin, displayName }: SignUpData) {
  try {
    // Create user with phone as email (use a valid email format)
    // Using .app domain which is a valid TLD
    const email = `${phone}@offlinepay.app`;
    const password = hashPin(pin);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          phone,
          display_name: displayName || `User ${phone.slice(-4)}`,
        },
      },
    });

    if (authError) {
      console.error("Auth signup error:", authError);
      throw new Error(authError.message || "Failed to create account. Please try again.");
    }

    if (!authData.user) {
      throw new Error("Failed to create user. Please try again.");
    }

    // Wait a moment for auth to settle
    await new Promise(resolve => setTimeout(resolve, 500));

    // Create profile
    const paymentId = generatePaymentId();
    const { error: profileError } = await supabase.from("profiles").insert({
      user_id: authData.user.id,
      phone,
      display_name: displayName || `User ${phone.slice(-4)}`,
      pin_hash: hashPin(pin),
      payment_id: paymentId,
      device_id: localStorage.getItem("offlinepay-device-id") || "web-" + Date.now(),
    });

    if (profileError) {
      console.error("Profile creation error:", profileError);
      // Rollback: delete the auth user
      await supabase.auth.signOut();
      throw new Error(`Failed to create profile: ${profileError.message}. Please ensure database is set up correctly.`);
    }

    // Create wallet with initial balance (demo purposes)
    const { error: walletError } = await supabase.from("wallets").insert({
      user_id: authData.user.id,
      balance: 1000.0, // Demo starting balance
    });

    if (walletError) {
      console.error("Wallet creation error:", walletError);
      throw new Error(`Failed to create wallet: ${walletError.message}`);
    }

    // Assign user role
    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: authData.user.id,
      role: "user",
    });

    if (roleError) {
      console.error("Failed to assign role:", roleError);
      // Don't throw here, just log - role is less critical
    }

    return { user: authData.user, paymentId };
  } catch (error: unknown) {
    console.error("SignUp error:", error);
    throw error;
  }
}

interface SignInData {
  phone: string;
  pin: string;
}

export async function signIn({ phone, pin }: SignInData) {
  try {
    const email = `${phone}@offlinepay.app`;
    const password = hashPin(pin);

    console.log('Login attempt for:', email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed. Please check your credentials.');
    }

    if (!data.user) {
      throw new Error("Login failed. No user data returned.");
    }

    console.log("Login successful");
    return data;
  } catch (error: unknown) {
    console.error("SignIn error:", error);
    throw error;
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getWallet(userId: string) {
  const { data, error } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  console.log("isAdmin check:", { userId, data, error, result: !error && data !== null });
  return !error && data !== null;
}
