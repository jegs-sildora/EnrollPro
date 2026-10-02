import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Star, AlertCircle, FileText } from "lucide-react";

export interface SCPCoordinatorDashboardProps {
  scpProgramName: string;
  totalApplicants: number;
  availableSlotsPerGrade: Record<number, number>;
  pendingScreeningCount: number;
  missingRequirementsAlerts: {
    applicantName: string;
    missingDocs: string[];
  }[];
  onReviewApplications: () => void;
  onGenerateRankList: () => void;
}

export function SCPCoordinatorDashboardView(props: SCPCoordinatorDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{props.scpProgramName} Admission</h2>
          <p className="text-muted-foreground">Special Curricular Program overview</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={props.onReviewApplications}>Review Applications</Button>
          <Button variant="outline" onClick={props.onGenerateRankList}>Generate Rank List</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Applicants</CardTitle>
            <Star className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{props.totalApplicants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Screening</CardTitle>
            <FileText className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{props.pendingScreeningCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Missing Requirements Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {props.missingRequirementsAlerts.map((alert, idx) => (
              <div key={idx} className="flex flex-col border-b pb-2">
                <span className="font-bold flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-500"/> {alert.applicantName}</span>
                <span className="text-muted-foreground text-sm ml-6">Missing: {alert.missingDocs.join(", ")}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
