import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Users, AlertCircle, FileText } from "lucide-react";

export interface GradeLevelCoordinatorDashboardProps {
  assignedGradeLevel: string;
  totalGradeEnrollees: number;
  unsectionedLearnersCount: number;
  sectionFillRates: {
    sectionName: string;
    fillPercentage: number;
    maleCount: number;
    femaleCount: number;
  }[];
  pendingWalkInApprovals: number;
  onAssignSections: () => void;
  onViewMasterlist: () => void;
}

export function GradeLevelCoordinatorDashboardView(props: GradeLevelCoordinatorDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{props.assignedGradeLevel} Coordinator</h2>
          <p className="text-muted-foreground">Grade-specific enrollment and sectioning</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={props.onAssignSections}>Section Assignment</Button>
          <Button variant="outline" onClick={props.onViewMasterlist}>View Masterlist</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Enrollees</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{props.totalGradeEnrollees}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Unsectioned</CardTitle>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{props.unsectionedLearnersCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{props.pendingWalkInApprovals}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Section Fill Rates & Ratios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {props.sectionFillRates.map((sec) => (
              <div key={sec.sectionName} className="flex justify-between items-center border-b pb-2">
                <span className="font-medium">{sec.sectionName}</span>
                <span className="text-muted-foreground">{sec.fillPercentage}% (M: {sec.maleCount} / F: {sec.femaleCount})</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
