import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, Share2, Download, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function ReceiveMoney() {
  const navigate = useNavigate();
  const { profile, isLoading } = useAuth();

  const qrValue = profile?.payment_id || "";

  const handleCopy = async () => {
    if (!profile?.payment_id) return;
    try {
      await navigator.clipboard.writeText(profile.payment_id);
      toast({ title: "Payment ID copied!" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    if (!profile?.payment_id) return;
    try {
      await navigator.share({
        title: "OfflinePay",
        text: `Pay me using OfflinePay!\nPayment ID: ${profile.payment_id}`,
      });
    } catch {
      // Share cancelled or not supported
      handleCopy();
    }
  };

  const handleDownload = () => {
    const svg = document.getElementById("qr-code");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");

      const downloadLink = document.createElement("a");
      downloadLink.download = `offlinepay-${profile?.payment_id}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
    toast({ title: "QR code downloaded!" });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
        <h1 className="font-semibold text-lg">Receive Money</h1>
      </header>

      <main className="flex-1 p-4 flex flex-col items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle>Your QR Code</CardTitle>
            <p className="text-sm text-muted-foreground">
              Show this to receive payment
            </p>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-6">
            {/* QR Code */}
            <div className="p-4 bg-white rounded-xl shadow-lg">
              <QRCodeSVG
                id="qr-code"
                value={qrValue}
                size={200}
                level="H"
                includeMargin
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>

            {/* Payment ID */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Payment ID</p>
              <p className="text-xl font-mono font-bold text-primary">
                {profile?.payment_id}
              </p>
            </div>

            {/* Name */}
            <div className="text-center">
              <p className="text-lg font-medium">
                {profile?.display_name || "User"}
              </p>
              <p className="text-sm text-muted-foreground">+91 {profile?.phone}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCopy}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy ID
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4 mr-2" />
              Download QR
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
