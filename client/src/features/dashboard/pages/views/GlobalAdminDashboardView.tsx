import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Users, AlertTriangle, FileText, Settings } from "lucide-react";

export interface GlobalAdminDashboardProps {
  totalEnrollees: number;
  pendingEnrollments: number;
  missingRequirementsCount: number;
  sectionCapacities: {
    gradeLevel: number;
    totalCapacity: number;
    currentEnrolled: number;
  }[];
  onOpenEnrollment: () => void;
  onAutoAssignSections: () => void;
  onViewAuditLogs: () => void;
}

export function GlobalAdminDashboardView(props: GlobalAdminDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Global Administration</h2>
          <p className="text-muted-foreground">School-wide enrollment and operational metrics</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={props.onOpenEnrollment}>Open Enrollment</Button>
          <Button variant="outline" onClick={props.onAutoAssignSections}>Auto-Assign Sections</Button>
          <Button variant="ghost" onClick={props.onViewAuditLogs}><Settings className="w-4 h-4 mr-2" /> Audit Logs</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Enrollees</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{props.totalEnrollees}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Enrollments</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{props.pendingEnrollments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Missing Requirements</CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{props.missingRequirementsCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Section Capacities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {props.sectionCapacities.map((cap) => (
              <div key={cap.gradeLevel} className="flex justify-between items-center border-b pb-2">
                <span className="font-medium">Grade {cap.gradeLevel}</span>
                <span className="text-muted-foreground">{cap.currentEnrolled} / {cap.totalCapacity}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
