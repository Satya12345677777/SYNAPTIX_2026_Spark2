import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { supabase } from "@/integrations/supabase/client";
import { getAllOfflineTransactions, PendingTransaction } from "@/lib/offlineDb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { format } from "date-fns";

interface Transaction {
  id: string;
  sender_id: string | null;
  receiver_id: string | null;
  amount: number;
  status: string;
  description: string | null;
  is_offline: boolean | null;
  created_at: string;
  synced_at: string | null;
}

export default function History() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingTx, setPendingTx] = useState<PendingTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");

  const fetchTransactions = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Fetch from Supabase
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setTransactions(data || []);

      // Fetch pending offline transactions
      const offline = await getAllOfflineTransactions();
      setPendingTx(offline);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "pending":
        return <Clock className="h-4 w-4 text-warning" />;
      case "failed":
      case "cancelled":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      pending: "secondary",
      failed: "destructive",
      cancelled: "destructive",
      syncing: "outline",
    };
    return (
      <Badge variant={variants[status] || "outline"} className="capitalize">
        {status}
      </Badge>
    );
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (filter === "all") return true;
    if (filter === "pending") return tx.status === "pending";
    if (filter === "completed") return tx.status === "completed";
    return true;
  });

  const allItems = [
    ...pendingTx.map((tx) => ({
      id: tx.id,
      type: "offline" as const,
      amount: tx.amount,
      status: tx.status,
      description: tx.description,
      timestamp: tx.timestamp,
      isSent: true,
      receiverId: tx.receiverId,
    })),
    ...filteredTransactions.map((tx) => ({
      id: tx.id,
      type: "synced" as const,
      amount: tx.amount,
      status: tx.status,
      description: tx.description,
      timestamp: new Date(tx.created_at).getTime(),
      isSent: tx.sender_id === user?.id,
      receiverId: tx.receiver_id,
      senderId: tx.sender_id,
      isOffline: tx.is_offline,
    })),
  ].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="min-h-screen bg-background flex flex-col pb-4">
      {/* Header */}
      <header className="flex items-center gap-3 p-4 border-b safe-area-top">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-lg">Transaction History</h1>
        <Badge
          variant={isOnline ? "default" : "destructive"}
          className={`ml-auto ${isOnline ? "status-online" : "status-offline"}`}
        >
          {isOnline ? (
            <Wifi className="h-3 w-3 mr-1" />
          ) : (
            <WifiOff className="h-3 w-3 mr-1" />
          )}
        </Badge>
        <Button variant="ghost" size="icon" onClick={fetchTransactions}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </header>

      <main className="flex-1 p-4">
        {/* Pending Offline Badge */}
        {pendingTx.length > 0 && (
          <Card className="mb-4 border-warning bg-warning/10">
            <CardContent className="p-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              <span className="text-sm">
                {pendingTx.length} pending offline transaction
                {pendingTx.length > 1 ? "s" : ""}
              </span>
            </CardContent>
          </Card>
        )}

        {/* Filter Tabs */}
        <Tabs
          value={filter}
          onValueChange={(value: "all" | "pending" | "completed") => setFilter(value)}
        >
          <TabsList className="w-full mb-4">
            <TabsTrigger value="all" className="flex-1">
              All
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex-1">
              Pending
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex-1">
              Completed
            </TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : allItems.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No transactions yet</p>
                </CardContent>
              </Card>
            ) : (
              allItems.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {/* Icon */}
                      <div
                        className={`p-2 rounded-full ${
                          item.isSent
                            ? "bg-destructive/10"
                            : "bg-success/10"
                        }`}
                      >
                        {item.isSent ? (
                          <ArrowUpRight
                            className={`h-5 w-5 ${
                              item.isSent
                                ? "text-destructive"
                                : "text-success"
                            }`}
                          />
                        ) : (
                          <ArrowDownLeft className="h-5 w-5 text-success" />
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">
                            {item.isSent ? "Sent" : "Received"}
                          </p>
                          {item.type === "offline" && (
                            <Badge variant="outline" className="text-xs">
                              Offline
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {item.description || "No description"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(item.timestamp), "MMM d, h:mm a")}
                        </p>
                      </div>

                      {/* Amount & Status */}
                      <div className="text-right">
                        <p
                          className={`font-bold ${
                            item.isSent ? "text-destructive" : "text-success"
                          }`}
                        >
                          {item.isSent ? "-" : "+"}₹
                          {item.amount.toLocaleString("en-IN")}
                        </p>
                        <div className="mt-1">
                          {getStatusBadge(item.status)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
