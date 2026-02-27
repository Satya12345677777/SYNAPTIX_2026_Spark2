import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useSyncEngine } from "@/hooks/useSyncEngine";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signOut } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import {
  Wallet,
  Send,
  QrCode,
  History,
  Settings,
  Wifi,
  WifiOff,
  LogOut,
  Loader2,
  ArrowDownLeft,
  ScanLine,
  RefreshCw,
} from "lucide-react";
import { useEffect } from "react";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile, wallet, isLoading } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { isSyncing, pendingCount, triggerSync } = useSyncEngine();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
    }
  }, [user, isLoading, navigate]);

  const handleLogout = async () => {
    try {
      await signOut();
      toast({ title: "Logged out successfully" });
      navigate("/");
    } catch (error) {
      toast({ title: "Error logging out", variant: "destructive" });
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const offlineRemaining = wallet
    ? wallet.offline_daily_limit - wallet.offline_used_today
    : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      {/* Header */}
      <header className="flex items-center justify-between p-4 safe-area-top">
        <div className="flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">OfflinePay</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={isOnline ? "default" : "destructive"}
            className={isOnline ? "status-online" : "status-offline"}
          >
            {isOnline ? (
              <><Wifi className="h-3 w-3 mr-1" />Online</>
            ) : (
              <><WifiOff className="h-3 w-3 mr-1" />Offline</>
            )}
          </Badge>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 space-y-6">
        {/* Wallet Card */}
        <Card className="wallet-gradient text-white overflow-hidden">
          <CardContent className="p-6">
            <p className="text-white/80 text-sm mb-1">Available Balance</p>
            <h2 className="text-4xl font-bold mb-4">
              ₹{wallet?.balance?.toLocaleString("en-IN") || "0.00"}
            </h2>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-white/60 text-xs">Payment ID</p>
                <p className="font-mono text-sm">{profile?.payment_id}</p>
              </div>
              <div className="text-right">
                <p className="text-white/60 text-xs">
                  {profile?.display_name || "User"}
                </p>
                <p className="text-xs text-white/80">+91 {profile?.phone}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Offline Limit Warning */}
        {!isOnline && (
          <Card className="border-warning bg-warning/10">
            <CardContent className="p-4 flex items-center gap-3">
              <WifiOff className="h-5 w-5 text-warning" />
              <div>
                <p className="font-medium text-sm">Offline Mode Active</p>
                <p className="text-xs text-muted-foreground">
                  Daily limit remaining: ₹{offlineRemaining.toLocaleString("en-IN")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Sync Banner */}
        {pendingCount > 0 && (
          <Card className="border-warning bg-warning/10">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <RefreshCw className={`h-5 w-5 text-warning ${isSyncing ? "animate-spin" : ""}`} />
                <div>
                  <p className="font-medium text-sm">
                    {pendingCount} pending transaction{pendingCount > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isSyncing ? "Syncing..." : "Tap to sync now"}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={triggerSync} disabled={isSyncing}>
                Sync
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: Send, label: "Send", color: "bg-primary", path: "/send" },
            { icon: ArrowDownLeft, label: "Receive", color: "bg-success", path: "/receive" },
            { icon: ScanLine, label: "Scan", color: "bg-accent", path: "/send" },
            { icon: History, label: "History", color: "bg-secondary", path: "/history" },
          ].map(({ icon: Icon, label, color, path }) => (
            <button
              key={label}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card hover:bg-muted transition-colors"
              onClick={() => navigate(path)}
            >
              <div className={`p-3 rounded-full ${color}`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>

        {/* Recent Transactions */}
        <div>
          <h3 className="font-semibold mb-3">Recent Transactions</h3>
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No transactions yet</p>
              <p className="text-sm">Your transaction history will appear here</p>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t safe-area-bottom">
        <div className="flex justify-around py-2">
          {[
            { icon: Wallet, label: "Home", active: true, path: "/dashboard" },
            { icon: History, label: "History", path: "/history" },
            { icon: QrCode, label: "Scan", path: "/send" },
            { icon: Settings, label: "Settings", path: "/settings" },
            { icon: LogOut, label: "Logout", onClick: handleLogout },
          ].map(({ icon: Icon, label, active, onClick, path }) => (
            <button
              key={label}
              onClick={onClick || (() => navigate(path!))}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
