import { useNavigate } from "react-router";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex h-full flex-1 min-h-[60vh] items-center justify-center p-4">
      <Card className="max-w-md w-full border-muted-foreground/20 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-muted-foreground/50 to-transparent" />
        
        {/* Subtle watermark */}
        <div className="absolute -right-4 -top-8 opacity-[0.03] pointer-events-none text-9xl font-black font-mono select-none">
          404
        </div>

        <CardContent className="pt-10 pb-8 px-8 flex flex-col items-center text-center space-y-6 relative z-10">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center shrink-0 shadow-sm border border-border">
            <FileQuestion className="h-8 w-8 text-muted-foreground" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold uppercase text-foreground tracking-tight">Page Not Found</h1>
            <p className="text-muted-foreground leading-relaxed text-sm">
              The system module, learner record, or page you are looking for does not exist or has been moved.
            </p>
          </div>

          <div className="w-full pt-2">
            <Button className="w-full font-bold h-11" onClick={() => navigate("/dashboard")}>
              Return to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
