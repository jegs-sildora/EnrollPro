import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { BookOpen, AlertCircle, CheckCircle2 } from "lucide-react";

interface RemedialWorkspaceProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  student: any;
}

export function RemedialWorkspace({ student }: RemedialWorkspaceProps) {
  // Mocking the deficiencies for the centralized list view
  const mockDeficiencies = [
    {
      id: 1,
      subject: "Mathematics",
      grade: 74,
      status: "PENDING_ENROLLMENT",
      teacher: "Pending Assignment",
    },
    {
      id: 2,
      subject: "Science",
      grade: 73,
      status: "ENROLLED",
      teacher: "Mr. Dela Cruz",
    },
  ];

  return (
    <div className="p-6 h-full flex flex-col bg-background">
      <div className="mb-6 max-w-4xl mx-auto w-full">
        <h2 className="text-2xl font-extrabold uppercase mb-2">Remedial Subject Assignments</h2>
        <p className="text-muted-foreground font-extrabold">
          The learner "{student?.fullName}" has been flagged as Conditionally Promoted.
          Please tag the required remedial subjects for the summer term.
        </p>
      </div>

      <div className="max-w-4xl mx-auto w-full space-y-4">
        {mockDeficiencies.map((def) => (
          <Card key={def.id} className="border shadow-sm">
            <CardHeader className="pb-3 flex flex-row justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl font-extrabold uppercase">
                  <BookOpen className="h-5 w-5 text-primary" />
                  {def.subject}
                </CardTitle>
                <CardDescription className="font-extrabold mt-1">
                  Final Grade: <span className="text-destructive">{def.grade}</span>
                </CardDescription>
              </div>
              <Badge
                variant={def.status === "ENROLLED" ? "default" : "outline"}
                className={
                  def.status === "PENDING_ENROLLMENT"
                    ? "text-amber-600 border-amber-600 bg-amber-50 uppercase font-extrabold"
                    : "bg-emerald-600 uppercase font-extrabold text-white"
                }
              >
                {def.status === "ENROLLED" ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Enrolled
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> Action Required
                  </span>
                )}
              </Badge>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between border-t pt-4 mt-2">
                <div className="text-sm font-extrabold text-muted-foreground">
                  Assigned Remedial Teacher: <span className="text-foreground">{def.teacher}</span>
                </div>
                {def.status === "PENDING_ENROLLMENT" && (
                  <Button size="sm" className="font-extrabold uppercase">
                    Tag Enrollment
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
