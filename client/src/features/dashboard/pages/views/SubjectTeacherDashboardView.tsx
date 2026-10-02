import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { BookOpen, Calendar, Edit3 } from "lucide-react";

export interface SubjectTeacherDashboardProps {
  assignedTeachingLoads: number;
  classesToday: number;
  pendingGradeEncodings: {
    subjectName: string;
    sectionName: string;
    deadline: string;
  }[];
  onViewSchedule: () => void;
  onAccessSMART: () => void;
}

export function SubjectTeacherDashboardView(props: SubjectTeacherDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Subject Teacher</h2>
          <p className="text-muted-foreground">Daily teaching loads and grading deadlines</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={props.onViewSchedule}><Calendar className="w-4 h-4 mr-2" /> View Schedule</Button>
          <Button variant="outline" onClick={props.onAccessSMART}><BookOpen className="w-4 h-4 mr-2" /> Access SMART</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Assigned Teaching Loads</CardTitle>
            <BookOpen className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{props.assignedTeachingLoads}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Classes Today</CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{props.classesToday}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Grade Encodings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {props.pendingGradeEncodings.map((grade, idx) => (
              <div key={idx} className="flex justify-between items-center border-b pb-2">
                <div className="flex flex-col">
                  <span className="font-bold">{grade.subjectName}</span>
                  <span className="text-muted-foreground text-sm">{grade.sectionName}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-red-500 text-sm font-medium">Due: {grade.deadline}</span>
                  <Button size="sm" variant="secondary"><Edit3 className="w-3 h-3 mr-1" /> Encode</Button>
                </div>
              </div>
            ))}
            {props.pendingGradeEncodings.length === 0 && (
              <div className="text-muted-foreground text-sm italic">All grades encoded.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
