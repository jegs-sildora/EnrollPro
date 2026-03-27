import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/ui/card";
import { Monitor } from "lucide-react";

export default function SystemHealth() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Monitor className="h-5 w-5" />
            System Health
          </CardTitle>
          <CardDescription>Monitor system status and server performance.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">System health monitoring coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
