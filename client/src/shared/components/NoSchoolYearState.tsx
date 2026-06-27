import { CalendarRange } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";

export function NoSchoolYearState() {
  return (
    <div className="flex h-[calc(100vh-10rem)] w-full items-center justify-center p-4">
      <Card className="max-w-md w-full border-dashed shadow-xl bg-card/50 backdrop-blur-md border-primary/20 hover:border-primary/40 transition-all duration-300">
        <CardContent className="pt-10 pb-10 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner animate-pulse">
            <CalendarRange className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="font-extrabold text-xl text-foreground tracking-tight">
              No Active School Year Selected
            </h3>
            <p className="text-base text-foreground/60 leading-relaxed px-6 ">
              Please select or create an active school year from the settings panel or use the school year switcher in the top bar to initialize and access the system features.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
