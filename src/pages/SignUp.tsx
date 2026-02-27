import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, Phone, KeyRound, User, ArrowLeft, Wallet } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { generateOTP, storeOTP, verifyOTP, signUp } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";

type Step = "phone" | "otp" | "pin" | "name";

export default function SignUp() {
  const navigate = useNavigate();
  const { refreshWallet, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState("");

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) {
      toast({
        title: "Invalid Phone",
        description: "Please enter a valid 10-digit phone number",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    // Generate and store OTP
    const newOtp = generateOTP();
    storeOTP(phone, newOtp);
    setGeneratedOtp(newOtp);

    // In production, send SMS here
    toast({
      title: "OTP Sent",
      description: `Demo OTP: ${newOtp}`,
    });

    setIsLoading(false);
    setStep("otp");
  };

  const handleOtpVerify = () => {
    if (otp.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter the 6-digit OTP",
        variant: "destructive",
      });
      return;
    }

    if (!verifyOTP(phone, otp)) {
      toast({
        title: "Invalid OTP",
        description: "The OTP you entered is incorrect or expired",
        variant: "destructive",
      });
      return;
    }

    setStep("pin");
  };

  const handlePinSubmit = () => {
    if (pin.length !== 4) {
      toast({
        title: "Invalid PIN",
        description: "Please enter a 4-digit PIN",
        variant: "destructive",
      });
      return;
    }

    if (pin !== confirmPin) {
      toast({
        title: "PIN Mismatch",
        description: "PINs do not match. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setStep("name");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { paymentId } = await signUp({
        phone,
        pin,
        displayName: displayName || undefined,
      });

      toast({
        title: "Account Created!",
        description: `Your Payment ID is ${paymentId}`,
      });

      // Wait for auth state to settle and refresh wallet/profile data
      await new Promise(resolve => setTimeout(resolve, 500));
      await Promise.all([refreshWallet(), refreshProfile()]);

      navigate("/dashboard");
    } catch (error: unknown) {
      console.error("Signup error details:", error);

      let errorMessage = "Something went wrong. Please try again.";
      const message = error instanceof Error ? error.message : undefined;

      // Provide more helpful error messages
      if (message) {
        if (message.includes("Email signups are disabled")) {
          errorMessage =
            "Email authentication is disabled. Please enable Email provider in Supabase Dashboard > Authentication > Providers.";
        } else if (message.includes("invalid") && message.includes("email")) {
          errorMessage =
            "Email format validation failed. Please check Supabase auth settings or try a different phone number.";
        } else if (message.includes("profiles") || message.includes("relation")) {
          errorMessage = "Database not set up. Please check SUPABASE_SETUP.md for instructions.";
        } else if (
          message.includes("already registered") ||
          message.includes("already exists") ||
          message.includes("User already registered")
        ) {
          errorMessage = "This phone number is already registered. Please try logging in instead.";
        } else if (message.includes("email")) {
          errorMessage = "Email confirmation may be required. Check Supabase Auth settings.";
        } else {
          errorMessage = message;
        }
      }

      toast({
        title: "Signup Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 7000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const goBack = () => {
    if (step === "otp") setStep("phone");
    else if (step === "pin") setStep("otp");
    else if (step === "name") setStep("pin");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 safe-area-top">
        {step !== "phone" ? (
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        ) : (
          <div className="w-10" />
        )}
        <div className="flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">OfflinePay</span>
        </div>
        <ThemeToggle />
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md animate-scale-in">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {step === "phone" && "Create Account"}
              {step === "otp" && "Verify Phone"}
              {step === "pin" && "Create PIN"}
              {step === "name" && "Almost Done!"}
            </CardTitle>
            <CardDescription>
              {step === "phone" && "Enter your mobile number to get started"}
              {step === "otp" && `Enter the OTP sent to +91 ${phone}`}
              {step === "pin" && "Create a 4-digit secure PIN"}
              {step === "name" && "Add your name (optional)"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Phone Step */}
            {step === "phone" && (
              <form onSubmit={handlePhoneSubmit} className="space-y-6">
                <div className="space-y-2">
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <Input
                      type="tel"
                      placeholder="Enter 10-digit mobile number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="pl-10 h-12 text-lg"
                      autoFocus
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full h-12 text-lg" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    "Get OTP"
                  )}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/login")}>
                    Login
                  </Button>
                </p>
              </form>
            )}

            {/* OTP Step */}
            {step === "otp" && (
              <div className="space-y-6">
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={(value) => setOtp(value)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {/* Demo OTP display */}
                <p className="text-center text-sm text-muted-foreground">
                  Demo OTP: <span className="font-mono font-bold text-primary">{generatedOtp}</span>
                </p>
                <Button onClick={handleOtpVerify} className="w-full h-12 text-lg">
                  Verify OTP
                </Button>
              </div>
            )}

            {/* PIN Step */}
            {step === "pin" && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Create PIN</label>
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={4}
                        value={pin}
                        onChange={(value) => setPin(value)}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Confirm PIN</label>
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={4}
                        value={confirmPin}
                        onChange={(value) => setConfirmPin(value)}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </div>
                </div>
                <Button onClick={handlePinSubmit} className="w-full h-12 text-lg">
                  Continue
                </Button>
              </div>
            )}

            {/* Name Step */}
            {step === "name" && (
              <form onSubmit={handleSignUp} className="space-y-6">
                <div className="space-y-2">
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Enter your name (optional)"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="pl-10 h-12 text-lg"
                      autoFocus
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full h-12 text-lg" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    "Create Account"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={handleSignUp}
                  disabled={isLoading}
                >
                  Skip for now
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
