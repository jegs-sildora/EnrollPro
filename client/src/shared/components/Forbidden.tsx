import { Link, useNavigate } from "react-router";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Lock } from "lucide-react";

export default function Forbidden() {
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-1 min-h-[60vh] items-center justify-center p-4">
      <Card className="max-w-md w-full border-muted-foreground/20 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
        <CardContent className="pt-10 pb-8 px-8 flex flex-col items-center text-center space-y-6">
          <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20">
            <Lock className="h-8 w-8 text-amber-500" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold uppercase text-foreground tracking-tight">Access Restricted</h1>
            <p className="text-muted-foreground leading-relaxed text-sm">
              Your current system role does not have permission to view this module. If you believe you need access to this school record or setting, please contact the System Administrator.
            </p>
          </div>

          <div className="w-full space-y-3 pt-2">
            <Button asChild className="w-full font-bold h-11">
              <Link to="/dashboard">Return to Dashboard</Link>
            </Button>
            <Button variant="outline" className="w-full font-bold h-11" onClick={() => navigate(-1)}>
              Go Back to Previous Page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
