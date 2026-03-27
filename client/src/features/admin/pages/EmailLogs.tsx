import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Mail } from "lucide-react";

export default function EmailLogs() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Mail className="h-5 w-5" />
            Email Logs
          </CardTitle>
          <CardDescription>View every email sent or failed.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Email delivery logs coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
