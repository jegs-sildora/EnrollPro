import { CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";

export function NoSchoolYearState() {
  return (
    <div className="flex h-[calc(100vh-20rem)] w-full items-center justify-center">
      <Card className="max-w-md w-full border-dashed shadow-none bg-muted/20">
        <CardContent className="pt-10 pb-10 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <CalendarDays className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="font-bold text-foreground">No School Year Selected</p>
            <p className="text-sm leading-relaxed px-4">
              Please set an active year or choose one from the header switcher
              to manage records for this period.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
