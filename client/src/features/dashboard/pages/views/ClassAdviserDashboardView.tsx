import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Users, FileText, Edit } from "lucide-react";

export interface ClassAdviserDashboardProps {
  advisorySectionName: string;
  totalLearners: number;
  maxCapacity: number;
  maleCount: number;
  femaleCount: number;
  missingDocumentsAlerts: {
    learnerName: string;
    missingDocs: string[];
  }[];
  onGoToAdvisoryRoster: () => void;
  onDownloadSF1: () => void;
  onEncodeSF9Grades: () => void;
}

export function ClassAdviserDashboardView(props: ClassAdviserDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Advisory Class: {props.advisorySectionName}</h2>
          <p className="text-muted-foreground">Class metrics and learner documents</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={props.onGoToAdvisoryRoster}>Advisory Roster</Button>
          <Button variant="outline" onClick={props.onDownloadSF1}>Download SF1</Button>
          <Button variant="secondary" onClick={props.onEncodeSF9Grades}><Edit className="w-4 h-4 mr-2"/>Encode SF9</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Section Capacity</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{props.totalLearners} / {props.maxCapacity}</div>
            <p className="text-sm text-muted-foreground mt-1">M: {props.maleCount} | F: {props.femaleCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Missing Credentials Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {props.missingDocumentsAlerts.map((alert, idx) => (
              <div key={idx} className="flex justify-between items-center border-b pb-2">
                <span className="font-bold">{alert.learnerName}</span>
                <span className="text-red-500 text-sm font-medium">{alert.missingDocs.join(", ")}</span>
              </div>
            ))}
            {props.missingDocumentsAlerts.length === 0 && (
              <div className="text-muted-foreground text-sm italic">All learners have submitted required documents.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
