import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { supabase } from "@/integrations/supabase/client";
import { addPendingTransaction, cacheRecipient, getCachedRecipientByPaymentId } from "@/lib/offlineDb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Send,
  QrCode,
  User,
  Wifi,
  WifiOff,
  Loader2,
  Camera,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

type Step = "input" | "confirm" | "success" | "error";

interface RecipientInfo {
  id: string;
  user_id: string;
  display_name: string | null;
  payment_id: string;
}

export default function SendMoney() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, wallet } = useAuth();
  const { isOnline } = useNetworkStatus();

  const [step, setStep] = useState<Step>("input");
  const [paymentId, setPaymentId] = useState(searchParams.get("to") || "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [recipient, setRecipient] = useState<RecipientInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    setScannerError(null);
    setShowScanner(true);
    
    // Wait for the container to be rendered
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("qr-reader");
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            // Extract payment ID from QR code
            let extractedPaymentId = decodedText;
            
            // Handle different QR code formats
            if (decodedText.includes("offlinepay://pay/")) {
              extractedPaymentId = decodedText.replace("offlinepay://pay/", "");
            } else if (decodedText.startsWith("OP")) {
              extractedPaymentId = decodedText;
            }
            
            // Clean up and set the payment ID
            extractedPaymentId = extractedPaymentId.trim().toUpperCase();
            
            stopScanner();
            setPaymentId(extractedPaymentId);
            toast({
              title: "QR Code Scanned!",
              description: `Payment ID: ${extractedPaymentId}`,
            });
          },
          () => {
            // Ignore scan errors (these happen continuously while scanning)
          }
        );
      } catch (error: unknown) {
        console.error("Scanner error:", error);
        const message = error instanceof Error ? error.message : undefined;
        setScannerError(message || "Failed to start camera");
        toast({
          title: "Camera Error",
          description: "Could not access camera. Please enter Payment ID manually.",
          variant: "destructive",
        });
      }
    }, 100);
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch (error) {
        console.error("Error stopping scanner:", error);
      }
    }
    setShowScanner(false);
    setScannerError(null);
  };

  const handleDemoScan = () => {
    stopScanner();
    setPaymentId("OP04141394");
    toast({ title: "Demo QR scanned", description: "Payment ID: OP04141394" });
  };

  const lookupRecipient = async () => {
    if (!paymentId.trim()) {
      toast({ title: "Enter a payment ID", variant: "destructive" });
      return;
    }

    const normalizedPaymentId = paymentId.trim().toUpperCase();
    setIsLoading(true);
    
    try {
      if (isOnline) {
        // Online: use Supabase RPC
        const { data, error } = await supabase.rpc("get_profile_by_payment_id", {
          _payment_id: normalizedPaymentId,
        });

        if (error) throw error;

        if (!data || data.length === 0) {
          toast({
            title: "User not found",
            description: "Check the payment ID and try again.",
            variant: "destructive",
          });
          return;
        }

        if (data[0].user_id === user?.id) {
          toast({
            title: "Cannot send to yourself",
            variant: "destructive",
          });
          return;
        }

        const recipientData = data[0];
        setRecipient(recipientData);
        
        // Cache recipient for offline use
        await cacheRecipient({
          id: recipientData.id,
          user_id: recipientData.user_id,
          display_name: recipientData.display_name,
          payment_id: recipientData.payment_id,
        });
      } else {
        // Offline: use cached recipient data
        const cachedRecipient = await getCachedRecipientByPaymentId(normalizedPaymentId);
        
        if (!cachedRecipient) {
          toast({
            title: "User not found offline",
            description: "This recipient hasn't been cached. Please connect to the internet to look them up first.",
            variant: "destructive",
          });
          return;
        }

        if (cachedRecipient.user_id === user?.id) {
          toast({
            title: "Cannot send to yourself",
            variant: "destructive",
          });
          return;
        }

        setRecipient({
          id: cachedRecipient.id,
          user_id: cachedRecipient.user_id,
          display_name: cachedRecipient.display_name,
          payment_id: cachedRecipient.payment_id,
        });
        
        toast({
          title: "Using cached data",
          description: "Recipient found from offline cache.",
        });
      }
    } catch (error) {
      console.error("Lookup error:", error);
      
      // Fallback to cached data if online lookup fails
      if (isOnline) {
        const cachedRecipient = await getCachedRecipientByPaymentId(normalizedPaymentId);
        if (cachedRecipient && cachedRecipient.user_id !== user?.id) {
          setRecipient({
            id: cachedRecipient.id,
            user_id: cachedRecipient.user_id,
            display_name: cachedRecipient.display_name,
            payment_id: cachedRecipient.payment_id,
          });
          toast({
            title: "Using cached data",
            description: "Network error - using offline cache.",
          });
          return;
        }
      }
      
      toast({
        title: "Error looking up user",
        description: "Check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const validateAmount = (): boolean => {
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return false;
    }

    if (numAmount > (wallet?.balance || 0)) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return false;
    }

    if (!isOnline) {
      const offlineRemaining =
        (wallet?.offline_daily_limit || 0) - (wallet?.offline_used_today || 0);
      if (numAmount > offlineRemaining) {
        toast({
          title: "Exceeds offline limit",
          description: `Remaining offline limit: ₹${offlineRemaining.toLocaleString("en-IN")}`,
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  const proceedToConfirm = () => {
    if (!recipient) {
      toast({ title: "Select a recipient first", variant: "destructive" });
      return;
    }
    if (!validateAmount()) return;
    setStep("confirm");
  };

  const executeTransaction = async () => {
    if (!user || !recipient || !wallet) return;

    setIsLoading(true);
    const numAmount = parseFloat(amount);

    try {
      if (isOnline) {
        // Online transaction via Supabase RPC
        const { data, error } = await supabase.rpc("process_transaction", {
          _sender_id: user.id,
          _receiver_id: recipient.user_id,
          _amount: numAmount,
          _description: description || null,
          _is_offline: false,
        });

        if (error) throw error;
        setTxId(data);
      } else {
        // Offline transaction stored in IndexedDB
        const tx = await addPendingTransaction({
          senderId: user.id,
          receiverId: recipient.user_id,
          receiverPhone: recipient.payment_id,
          amount: numAmount,
          description: description || undefined,
        });
        setTxId(tx.id);

        // Update local wallet balance (optimistic)
        // This will be reconciled when sync happens
      }

      setStep("success");
    } catch (error: unknown) {
      console.error("Transaction error:", error);
      setStep("error");
      const message = error instanceof Error ? error.message : undefined;
      toast({
        title: "Transaction failed",
        description: message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (showScanner) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b bg-background">
          <Button
            variant="ghost"
            size="icon"
            onClick={stopScanner}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Scan QR Code</h1>
        </div>
        
        {/* Camera View */}
        <div className="flex-1 relative bg-black flex items-center justify-center px-4">
          <div
            id="qr-reader"
            ref={scannerContainerRef}
            className="w-full max-w-sm aspect-square"
          />
          {scannerError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background p-4">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-center text-destructive font-medium mb-2">Camera Error</p>
              <p className="text-center text-muted-foreground text-sm mb-4">{scannerError}</p>
              <Button onClick={startScanner} variant="outline">
                Try Again
              </Button>
            </div>
          )}
        </div>
        
        {/* Demo Button */}
        <div className="p-4 bg-background border-t">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleDemoScan}
          >
            <QrCode className="h-4 w-4 mr-2" />
            Demo: Use Test Payment ID
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Point camera at a QR code or use the demo button above
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 p-4 border-b safe-area-top">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-lg">Send Money</h1>
        <Badge
          variant={isOnline ? "default" : "destructive"}
          className={`ml-auto ${isOnline ? "status-online" : "status-offline"}`}
        >
          {isOnline ? (
            <Wifi className="h-3 w-3 mr-1" />
          ) : (
            <WifiOff className="h-3 w-3 mr-1" />
          )}
          {isOnline ? "Online" : "Offline"}
        </Badge>
      </header>

      <main className="flex-1 p-4">
        {step === "input" && (
          <div className="space-y-6">
            {/* QR Scan Option */}
            <Card
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={startScanner}
            >
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary">
                  <Camera className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-medium">Scan QR Code</p>
                  <p className="text-sm text-muted-foreground">
                    Use camera to scan recipient's QR
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-sm text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Payment ID Input */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Payment ID
                </label>
                <div className="flex gap-2">
                  <Input
                    value={paymentId}
                    onChange={(e) => setPaymentId(e.target.value.toUpperCase())}
                    placeholder="OP12345678"
                    className="flex-1 font-mono"
                  />
                  <Button onClick={lookupRecipient} disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Find"
                    )}
                  </Button>
                </div>
              </div>

              {recipient && (
                <Card className="border-primary bg-primary/5">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/20">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {recipient.display_name || "User"}
                      </p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {recipient.payment_id}
                      </p>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-success ml-auto" />
                  </CardContent>
                </Card>
              )}

              {recipient && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Amount (₹)
                    </label>
                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="text-2xl font-bold h-14"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Balance: ₹{wallet?.balance?.toLocaleString("en-IN") || "0"}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Note (optional)
                    </label>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What's this for?"
                    />
                  </div>

                  <Button
                    className="w-full h-12"
                    size="lg"
                    onClick={proceedToConfirm}
                  >
                    <Send className="h-5 w-5 mr-2" />
                    Continue
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {step === "confirm" && recipient && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-center">Confirm Payment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-primary">
                    ₹{parseFloat(amount).toLocaleString("en-IN")}
                  </p>
                  {!isOnline && (
                    <Badge variant="outline" className="mt-2">
                      Will sync when online
                    </Badge>
                  )}
                </div>

                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">To</span>
                    <span className="font-medium">
                      {recipient.display_name || "User"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment ID</span>
                    <span className="font-mono">{recipient.payment_id}</span>
                  </div>
                  {description && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Note</span>
                      <span>{description}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep("input")}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={executeTransaction}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mb-6 animate-scale-in">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <h2 className="text-2xl font-bold mb-2">
              {isOnline ? "Payment Sent!" : "Payment Queued!"}
            </h2>
            <p className="text-muted-foreground mb-2">
              ₹{parseFloat(amount).toLocaleString("en-IN")} to{" "}
              {recipient?.display_name || "User"}
            </p>
            {!isOnline && (
              <Badge variant="outline" className="mb-4">
                Will complete when you're online
              </Badge>
            )}
            <p className="text-xs text-muted-foreground font-mono mb-6">
              ID: {txId?.slice(0, 16)}...
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate("/history")}>
                View History
              </Button>
              <Button onClick={() => navigate("/dashboard")}>Done</Button>
            </div>
          </div>
        )}

        {step === "error" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center mb-6">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Payment Failed</h2>
            <p className="text-muted-foreground mb-6">
              Something went wrong. Please try again.
            </p>
            <Button onClick={() => setStep("input")}>Try Again</Button>
          </div>
        )}
      </main>
    </div>
  );
}
