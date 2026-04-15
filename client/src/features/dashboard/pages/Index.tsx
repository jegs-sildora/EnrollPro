import { useEffect, useState } from "react";
import {
  ClipboardList,
  Users,
  CheckCircle,
  AlertTriangle,
  UserCog,
  Mail,
  Activity,
  ShieldCheck,
  FileText,
  FileCheck,
  GitPullRequest,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useAuthStore } from "@/store/auth.slice";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { Badge } from "@/shared/ui/badge";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";

interface Stats {
  totalPending: number;
  totalEnrolled: number;
  totalPreRegistered: number;
  sectionsAtCapacity: number;
  earlyRegistration?: {
    submitted: number;
    verified: number;
    inPipeline: number;
    total: number;
  };
}

interface AdminStats {
  activeUsers: number;
  usersByRole: Record<string, number>;
  emailDeliveryRate: string;
  systemStatus: string;
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "SYSTEM_ADMIN";

  const [stats, setStats] = useState<Stats | null>(null);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Rule A & B: Delayed loading
  const showSkeleton = useDelayedLoading(loading);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [statsRes, adminRes] = await Promise.all([
          api.get("/dashboard/stats"),
          isAdmin
            ? api.get("/admin/dashboard/stats")
            : Promise.resolve({ data: null }),
        ]);

        setStats(statsRes.data.stats);
        if (adminRes.data) setAdminStats(adminRes.data);
      } catch {
        // Fallbacks
        setStats({
          totalPending: 0,
          totalEnrolled: 0,
          totalPreRegistered: 0,
          sectionsAtCapacity: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAdmin]);

  const earlyRegCards = [
    {
      title: "Early Reg Submitted",
      value: stats?.earlyRegistration?.submitted ?? 0,
      icon: FileText,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      title: "Early Reg Verified",
      value: stats?.earlyRegistration?.verified ?? 0,
      icon: FileCheck,
      color: "text-teal-600",
      bg: "bg-teal-50",
    },
    {
      title: "In Pipeline",
      value: stats?.earlyRegistration?.inPipeline ?? 0,
      icon: GitPullRequest,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      title: "Total Early Registrations",
      value: stats?.earlyRegistration?.total ?? 0,
      icon: ClipboardList,
      color: "text-slate-600",
      bg: "bg-slate-50",
    },
  ];

  const statCards = [
    {
      title: "Pending Review",
      value: stats?.totalPending ?? 0,
      icon: ClipboardList,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
    {
      title: "Total Enrolled",
      value: stats?.totalEnrolled ?? 0,
      icon: Users,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "Pre-registered",
      value: stats?.totalPreRegistered ?? 0,
      icon: CheckCircle,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Sections at Capacity",
      value: stats?.sectionsAtCapacity ?? 0,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
  ];

  const adminCards = [
    {
      title: "Active Users",
      value: adminStats?.activeUsers ?? 0,
      description: `${adminStats?.usersByRole["REGISTRAR"] || 0} Reg · ${adminStats?.usersByRole["TEACHER"] || 0} Tea`,
      icon: UserCog,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "Email Delivery",
      value: `${adminStats?.emailDeliveryRate ?? "0.0"}%`,
      description: "Last 30 days success rate",
      icon: Mail,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      title: "System Status",
      value: adminStats?.systemStatus === "OK" ? "Healthy" : "Error",
      description: "Database & Core Services",
      icon: Activity,
      color:
        adminStats?.systemStatus === "OK" ? "text-green-600" : "text-red-600",
      bg: adminStats?.systemStatus === "OK" ? "bg-green-50" : "bg-red-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back,{" "}
            <span className="font-semibold text-primary">
              {user?.firstName} {user?.lastName}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="h-6 gap-1 bg-sidebar-accent text-primary border-primary border-opacity-20">
            <ShieldCheck className="h-3 w-3" />
            {user?.role} Access
          </Badge>
        </div>
      </div>

      {/* Admin Panel (If Admin) */}
      {isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-purple-600 opacity-80">
              System Oversight
            </h2>
            <div className="h-px flex-1 bg-purple-100"></div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {adminCards.map((stat) => (
              <Card key={stat.title} className="border-purple-100 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-bold uppercase text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`${stat.bg} rounded-md p-2`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  {showSkeleton ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <>
                      <div className="text-2xl font-black">{stat.value}</div>
                      <p className="text-[0.625rem] text-muted-foreground mt-1">
                        {stat.description}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Early Registration Stats */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-amber-600 opacity-80">
            Early Registration
          </h2>
          <div className="h-px flex-1 bg-amber-100"></div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {earlyRegCards.map((stat) => (
            <Card key={stat.title} className="shadow-sm border-amber-100">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`${stat.bg} rounded-md p-2`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                {showSkeleton ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-black">{stat.value}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Enrollment Stats Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-primary opacity-80">
            Enrollment Progress
          </h2>
          <div className="h-px flex-1 bg-sidebar-accent"></div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.title} className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`${stat.bg} rounded-md p-2`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                {showSkeleton ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-black">{stat.value}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Activity and Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-sm border-opacity-50">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Quick Overview</CardTitle>
            <CardDescription>
              Enrollment trends and distribution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 flex-col items-center justify-center text-center space-y-2">
              <div className="rounded-full bg-muted p-3">
                <Activity className="h-6 w-6 text-muted-foreground opacity-20" />
              </div>
              <p className="text-xs text-muted-foreground max-w-50">
                Charts and analytics are being prepared for the current school
                year.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-opacity-50">
          <CardHeader>
            <CardTitle className="text-lg font-bold">
              Recent System Logs
            </CardTitle>
            <CardDescription>Latest administrative actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No recent activity to display.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
