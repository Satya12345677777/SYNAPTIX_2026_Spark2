import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signOut } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import {
  Shield,
  Users,
  Wallet,
  ArrowLeftRight,
  AlertTriangle,
  LogOut,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, subDays } from "date-fns";

interface Stats {
  totalUsers: number;
  totalWalletBalance: number;
  totalTransactions: number;
  pendingTransactions: number;
  flaggedTransactions: number;
}

interface Transaction {
  id: string;
  sender_id: string | null;
  receiver_id: string | null;
  amount: number;
  status: string;
  description: string | null;
  is_offline: boolean | null;
  fraud_flagged: boolean | null;
  fraud_reason: string | null;
  created_at: string;
}

interface User {
  id: string;
  user_id: string;
  phone: string;
  display_name: string | null;
  payment_id: string;
  is_active: boolean | null;
  created_at: string;
}

interface DailyChartPoint {
  date: string;
  volume: number;
  count: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();

  const [stats, setStats] = useState<Stats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [chartData, setChartData] = useState<DailyChartPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!authLoading) {
      console.log("Admin Dashboard - Auth check:", { user: !!user, isAdmin });
      if (!user || !isAdmin) {
        console.log("Redirecting to admin login - no user or not admin");
        navigate("/admin/login");
      }
    }
  }, [user, isAdmin, authLoading, navigate]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch stats
      const [usersRes, walletsRes, txRes, pendingRes, flaggedRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("wallets").select("balance"),
        supabase.from("transactions").select("id", { count: "exact", head: true }),
        supabase.from("transactions").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("transactions").select("id", { count: "exact", head: true }).eq("fraud_flagged", true),
      ]);

      const totalBalance = walletsRes.data?.reduce((sum, w) => sum + Number(w.balance), 0) || 0;

      setStats({
        totalUsers: usersRes.count || 0,
        totalWalletBalance: totalBalance,
        totalTransactions: txRes.count || 0,
        pendingTransactions: pendingRes.count || 0,
        flaggedTransactions: flaggedRes.count || 0,
      });

      // Fetch recent transactions
      const { data: txData } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      setTransactions(txData || []);

      // Fetch users
      const { data: userData } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      setUsers(userData || []);

      // Generate chart data (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), 6 - i);
        return {
          date: format(date, "MMM d"),
          dateKey: format(date, "yyyy-MM-dd"),
        };
      });

      const { data: dailyTx } = await supabase
        .from("transactions")
        .select("created_at, amount")
        .gte("created_at", subDays(new Date(), 7).toISOString());

      const dailyVolume = last7Days.map((day) => {
        const dayTransactions = (dailyTx || []).filter(
          (tx) => format(new Date(tx.created_at), "yyyy-MM-dd") === day.dateKey
        );
        return {
          date: day.date,
          volume: dayTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0),
          count: dayTransactions.length,
        };
      });

      setChartData(dailyVolume);
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      fetchData();
    }
  }, [user, isAdmin]);

  const handleApprove = async (txId: string) => {
    try {
      await supabase
        .from("transactions")
        .update({ status: "completed", fraud_flagged: false })
        .eq("id", txId);
      toast({ title: "Transaction approved" });
      fetchData();
    } catch (error) {
      toast({ title: "Error approving transaction", variant: "destructive" });
    }
  };

  const handleReject = async (txId: string) => {
    try {
      await supabase
        .from("transactions")
        .update({ status: "cancelled", fraud_reason: "Rejected by admin" })
        .eq("id", txId);
      toast({ title: "Transaction rejected" });
      fetchData();
    } catch (error) {
      toast({ title: "Error rejecting transaction", variant: "destructive" });
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex items-center justify-between p-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="font-bold text-xl">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={fetchData}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="pending">Pending Syncs</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Users className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
                      <p className="text-sm text-muted-foreground">Users</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-8 w-8 text-success" />
                    <div>
                      <p className="text-2xl font-bold">
                        ₹{(stats?.totalWalletBalance || 0).toLocaleString("en-IN")}
                      </p>
                      <p className="text-sm text-muted-foreground">Total Balance</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <ArrowLeftRight className="h-8 w-8 text-accent" />
                    <div>
                      <p className="text-2xl font-bold">{stats?.totalTransactions || 0}</p>
                      <p className="text-sm text-muted-foreground">Transactions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Clock className="h-8 w-8 text-warning" />
                    <div>
                      <p className="text-2xl font-bold">{stats?.pendingTransactions || 0}</p>
                      <p className="text-sm text-muted-foreground">Pending</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                    <div>
                      <p className="text-2xl font-bold">{stats?.flaggedTransactions || 0}</p>
                      <p className="text-sm text-muted-foreground">Flagged</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Transaction Volume (Last 7 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="volume"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle>All Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-mono text-xs">
                          {tx.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>₹{Number(tx.amount).toLocaleString("en-IN")}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              tx.status === "completed"
                                ? "default"
                                : tx.status === "pending"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {tx.status}
                          </Badge>
                          {tx.fraud_flagged && (
                            <Badge variant="destructive" className="ml-1">
                              Flagged
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {tx.is_offline ? (
                            <Badge variant="outline">Offline</Badge>
                          ) : (
                            <Badge variant="outline">Online</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(tx.created_at), "MMM d, h:mm a")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Registered Users</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Payment ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>{u.display_name || "—"}</TableCell>
                        <TableCell>+91 {u.phone}</TableCell>
                        <TableCell className="font-mono">{u.payment_id}</TableCell>
                        <TableCell>
                          <Badge variant={u.is_active ? "default" : "secondary"}>
                            {u.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(u.created_at), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pending Syncs Tab */}
          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Pending & Flagged Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions
                      .filter((tx) => tx.status === "pending" || tx.fraud_flagged)
                      .map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="font-mono text-xs">
                            {tx.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell>₹{Number(tx.amount).toLocaleString("en-IN")}</TableCell>
                          <TableCell>
                            <Badge
                              variant={tx.fraud_flagged ? "destructive" : "secondary"}
                            >
                              {tx.fraud_flagged ? "Flagged" : tx.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {tx.fraud_reason || "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApprove(tx.id)}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(tx.id)}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    {transactions.filter((tx) => tx.status === "pending" || tx.fraud_flagged)
                      .length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No pending or flagged transactions
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
