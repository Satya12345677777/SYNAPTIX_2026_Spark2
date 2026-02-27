import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  User, 
  Lock, 
  Bell, 
  BellRing,
  Loader2, 
  Save,
  Shield,
  Smartphone
} from "lucide-react";
import { hashPin } from "@/lib/auth";

export default function Settings() {
  const navigate = useNavigate();
  const { profile, refreshProfile, user } = useAuth();
  const pushNotifications = usePushNotifications();
  
  // Profile state
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // PIN change state
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isChangingPin, setIsChangingPin] = useState(false);
  
  // Notification preferences (stored locally for demo)
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem("offlinepay-notifications");
    return saved ? JSON.parse(saved) : {
      transactionAlerts: true,
      syncNotifications: true,
      securityAlerts: true,
      promotions: false,
    };
  });

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim() })
        .eq("user_id", user.id);

      if (error) throw error;

      await refreshProfile();
      toast({ title: "Profile updated successfully!" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to update profile";
      toast({
        title: "Failed to update profile",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePin = async () => {
    if (!user || !profile) return;
    
    // Validate inputs
    if (currentPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4) {
      toast({
        title: "Invalid PIN",
        description: "PIN must be 4 digits",
        variant: "destructive",
      });
      return;
    }
    
    if (newPin !== confirmPin) {
      toast({
        title: "PINs don't match",
        description: "New PIN and confirmation must match",
        variant: "destructive",
      });
      return;
    }
    
    // Verify current PIN
    if (hashPin(currentPin) !== profile.pin_hash) {
      toast({
        title: "Incorrect current PIN",
        description: "Please enter your current PIN correctly",
        variant: "destructive",
      });
      return;
    }
    
    setIsChangingPin(true);
    try {
      // Update PIN hash in profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ pin_hash: hashPin(newPin) })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      // Update auth password
      const { error: authError } = await supabase.auth.updateUser({
        password: hashPin(newPin),
      });

      if (authError) throw authError;

      await refreshProfile();
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      toast({ title: "PIN changed successfully!" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to change PIN";
      toast({
        title: "Failed to change PIN",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsChangingPin(false);
    }
  };

  const handleNotificationChange = (key: string, value: boolean) => {
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    localStorage.setItem("offlinepay-notifications", JSON.stringify(updated));
    toast({ title: "Preferences saved" });
  };

  const handlePushToggle = async () => {
    if (pushNotifications.isSubscribed) {
      const success = await pushNotifications.unsubscribe();
      if (success) {
        toast({ title: "Push notifications disabled" });
      } else {
        toast({ title: "Failed to disable notifications", variant: "destructive" });
      }
    } else {
      const success = await pushNotifications.subscribe();
      if (success) {
        toast({ title: "Push notifications enabled!" });
      } else if (pushNotifications.permission === "denied") {
        toast({ 
          title: "Permission denied", 
          description: "Enable notifications in browser settings",
          variant: "destructive" 
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-6 pb-8">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Profile</CardTitle>
            </div>
            <CardDescription>Manage your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                maxLength={50}
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-muted-foreground">Phone Number</Label>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{profile?.phone || "Not set"}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-muted-foreground">Payment ID</Label>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-mono">{profile?.payment_id || "Not set"}</span>
              </div>
            </div>
            
            <Button 
              onClick={handleSaveProfile} 
              disabled={isSavingProfile || displayName === profile?.display_name}
              className="w-full"
            >
              {isSavingProfile ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Profile
            </Button>
          </CardContent>
        </Card>

        {/* PIN Change Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Change PIN</CardTitle>
            </div>
            <CardDescription>Update your 4-digit security PIN</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPin">Current PIN</Label>
              <Input
                id="currentPin"
                type="password"
                inputMode="numeric"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                maxLength={4}
              />
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label htmlFor="newPin">New PIN</Label>
              <Input
                id="newPin"
                type="password"
                inputMode="numeric"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                maxLength={4}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPin">Confirm New PIN</Label>
              <Input
                id="confirmPin"
                type="password"
                inputMode="numeric"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                maxLength={4}
              />
            </div>
            
            <Button 
              onClick={handleChangePin} 
              disabled={isChangingPin || !currentPin || !newPin || !confirmPin}
              variant="secondary"
              className="w-full"
            >
              {isChangingPin ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              Change PIN
            </Button>
          </CardContent>
        </Card>

        {/* Push Notifications Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Push Notifications</CardTitle>
              {pushNotifications.isSubscribed && (
                <Badge variant="secondary" className="ml-auto">Enabled</Badge>
              )}
            </div>
            <CardDescription>
              Receive real-time alerts on your device
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!pushNotifications.isSupported ? (
              <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                Push notifications are not supported in this browser.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Push Notifications</Label>
                    <p className="text-xs text-muted-foreground">
                      {pushNotifications.permission === "denied" 
                        ? "Blocked - enable in browser settings"
                        : "Get instant transaction and sync alerts"}
                    </p>
                  </div>
                  <Switch
                    checked={pushNotifications.isSubscribed}
                    onCheckedChange={handlePushToggle}
                    disabled={pushNotifications.isLoading || pushNotifications.permission === "denied"}
                  />
                </div>
                {pushNotifications.isLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Setting up notifications...
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Notification Preferences Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Notification Preferences</CardTitle>
            </div>
            <CardDescription>Choose which alerts you want to receive</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="transactionAlerts">Transaction Alerts</Label>
                <p className="text-xs text-muted-foreground">Get notified for all transactions</p>
              </div>
              <Switch
                id="transactionAlerts"
                checked={notifications.transactionAlerts}
                onCheckedChange={(checked) => handleNotificationChange("transactionAlerts", checked)}
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="syncNotifications">Sync Notifications</Label>
                <p className="text-xs text-muted-foreground">Alerts when offline transactions sync</p>
              </div>
              <Switch
                id="syncNotifications"
                checked={notifications.syncNotifications}
                onCheckedChange={(checked) => handleNotificationChange("syncNotifications", checked)}
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="securityAlerts">Security Alerts</Label>
                <p className="text-xs text-muted-foreground">Important security notifications</p>
              </div>
              <Switch
                id="securityAlerts"
                checked={notifications.securityAlerts}
                onCheckedChange={(checked) => handleNotificationChange("securityAlerts", checked)}
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="promotions">Promotions & Offers</Label>
                <p className="text-xs text-muted-foreground">Receive promotional updates</p>
              </div>
              <Switch
                id="promotions"
                checked={notifications.promotions}
                onCheckedChange={(checked) => handleNotificationChange("promotions", checked)}
              />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
