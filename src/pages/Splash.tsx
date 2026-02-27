import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Wallet, Wifi, WifiOff, Loader2 } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Splash() {
  const navigate = useNavigate();
  const { isOnline } = useNetworkStatus();
  const { user, isLoading } = useAuth();
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        navigate("/dashboard", { replace: true });
      } else {
        setShowContent(true);
      }
    }
  }, [isLoading, user, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="animate-bounce-slow mb-8">
        <div className="w-24 h-24 rounded-3xl wallet-gradient flex items-center justify-center shadow-lg">
          <Wallet className="h-12 w-12 text-white" />
        </div>
      </div>

      {/* App Name */}
      <h1 className="text-4xl font-bold mb-2 animate-fade-in">OfflinePay</h1>
      <p className="text-muted-foreground mb-8 animate-fade-in">
        Pay anywhere, even offline
      </p>

      {/* Network Status */}
      <Badge
        variant={isOnline ? "default" : "destructive"}
        className={`mb-8 animate-fade-in ${isOnline ? "status-online" : "status-offline"}`}
      >
        {isOnline ? (
          <>
            <Wifi className="h-3 w-3 mr-1" />
            Online
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3 mr-1" />
            Offline
          </>
        )}
      </Badge>

      {/* Loading or Actions */}
      {isLoading ? (
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      ) : showContent && !user ? (
        <div className="space-y-4 w-full max-w-xs animate-slide-up">
          <Button
            className="w-full h-12 text-lg"
            onClick={() => navigate("/signup")}
          >
            Get Started
          </Button>
          <Button
            variant="outline"
            className="w-full h-12 text-lg"
            onClick={() => navigate("/login")}
          >
            I already have an account
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading...</span>
        </div>
      )}

      {/* Offline Warning */}
      {!isOnline && showContent && !user && (
        <p className="text-sm text-muted-foreground mt-8 text-center animate-fade-in">
          Internet required for signup/login.
          <br />
          Offline mode available after first login.
        </p>
      )}
    </div>
  );
}
