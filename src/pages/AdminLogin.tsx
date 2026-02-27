import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Shield, Loader2, ArrowLeft } from "lucide-react";
import { hashPin } from "@/lib/auth";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (phone.length !== 10 || pin.length !== 4) {
      toast({
        title: "Invalid credentials",
        description: "Enter valid phone and 4-digit PIN",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Use the same hash function as regular login
      const hashedPin = hashPin(pin);

      // Login with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: `${phone}@offlinepay.app`,
        password: hashedPin,
      });

      if (authError) throw authError;

      // Check if user has admin role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id)
        .eq("role", "admin");

      if (roleError) throw roleError;

      if (!roleData || roleData.length === 0) {
        await supabase.auth.signOut();
        toast({
          title: "Access Denied",
          description: "You don't have admin privileges.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Admin login successful!" });
      
      // Wait a bit for auth state to update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      navigate("/admin");
    } catch (error: unknown) {
      console.error("Admin login error:", error);
      const message =
        error instanceof Error ? error.message || "Invalid credentials" : "Invalid credentials";
      toast({
        title: "Login failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Button
        variant="ghost"
        className="absolute top-4 left-4"
        onClick={() => navigate("/")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Admin Login</CardTitle>
          <CardDescription>Access the admin dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Phone Number
              </label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit number"
                maxLength={10}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">PIN</label>
              <Input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="4-digit PIN"
                maxLength={4}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Shield className="h-4 w-4 mr-2" />
              )}
              Login as Admin
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
