import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Loader2, Users, ArrowRightLeft, UserMinus, ShieldAlert } from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { queryKeys } from "@/shared/lib/queryKeys";
import { Badge } from "@/shared/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

interface SectionRosterModalProps {
  sectionId: number;
  onClose: () => void;
}

export function SectionRosterModal({ sectionId, onClose }: SectionRosterModalProps) {
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [targetSectionMap, setTargetSectionMap] = useState<Record<number, string>>({});

  const { data: rosterData, isLoading } = useQuery({
    queryKey: ["section-roster", sectionId],
    queryFn: () => api.get(`/sections/${sectionId}/roster`).then((r) => r.data),
    refetchInterval: 5000,
  });

  const { data: allSections } = useQuery({
    queryKey: queryKeys.sectioningSections(),
    queryFn: () => api.get("/sectioning/sections-summary").then((r) => r.data),
  });

  const learners = rosterData?.learners || [];
  const section = rosterData?.section;

  // Find compatible sections for transfer (same grade level, active)
  const compatibleSections = useMemo(() => {
    if (!allSections || !section) return [];
    return allSections.filter(
      (s: any) => s.gradeLevel === section.gradeLevel && s.id !== section.id
    );
  }, [allSections, section]);

  const handleUnassign = async (enrollmentApplicationId: number) => {
    setProcessingId(enrollmentApplicationId);
    try {
      await api.post("/sections/transfer-learner", {
        enrollmentApplicationId,
        targetSectionId: null,
        reason: "Manual unassignment to pool",
      });
      sileo.success({ title: "Unassigned", description: "Learner returned to unassigned pool." });
      void queryClient.invalidateQueries({ queryKey: ["section-roster", sectionId] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sectioningPool() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sectioningSections() });
    } catch (err: any) {
      sileo.error({ title: "Failed", description: err.response?.data?.message || "Could not unassign learner." });
    } finally {
      setProcessingId(null);
    }
  };

  const handleTransfer = async (enrollmentApplicationId: number, targetId: string) => {
    if (!targetId) return;
    setProcessingId(enrollmentApplicationId);
    try {
      await api.post("/sections/transfer-learner", {
        enrollmentApplicationId,
        targetSectionId: parseInt(targetId, 10),
        reason: "Manual transfer",
      });
      sileo.success({ title: "Transferred", description: "Learner moved to another section." });
      void queryClient.invalidateQueries({ queryKey: ["section-roster", sectionId] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sectioningPool() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sectioningSections() });
    } catch (err: any) {
      sileo.error({ title: "Failed", description: err.response?.data?.message || "Could not transfer learner." });
    } finally {
      setProcessingId(null);
      setTargetSectionMap((prev) => {
        const next = { ...prev };
        delete next[enrollmentApplicationId];
        return next;
      });
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-card border-border shadow-xl">
        <DialogHeader className="p-6 border-b border-border bg-muted/30">
          <DialogTitle className="text-xl font-black uppercase tracking-wide flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {section?.name || "Loading Roster..."}
            {section && (
              <Badge variant="outline" className="ml-2 bg-background font-bold">
                {learners.length} / {section.maxCapacity}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-base font-bold text-muted-foreground uppercase tracking-widest mt-1">
            {section?.gradeLevel} • {section?.programType}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-4 relative">
          {isLoading ? (
            <div className="h-48 flex items-center justify-center flex-col gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-base leading-tight font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Loading Roster...</span>
            </div>
          ) : learners.length === 0 ? (
            <div className="h-48 flex items-center justify-center flex-col gap-3 text-muted-foreground">
              <ShieldAlert className="h-10 w-10 opacity-50" />
              <span className="font-bold text-base leading-tight">No learners assigned to this section yet.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {learners.map((l: any) => {
                const isProcessing = processingId === l.enrollmentApplicationId;
                const selectedTarget = targetSectionMap[l.enrollmentApplicationId] || "";

                return (
                  <div key={l.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-background hover:bg-muted/30 transition-colors">
                    <div className="flex flex-col">
                      <span className="font-black text-base leading-tight uppercase text-foreground">
                        {l.lastName}, {l.firstName} {l.middleName?.charAt(0) ? `${l.middleName.charAt(0)}.` : ""}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-muted-foreground tracking-widest">{l.lrn || "NO LRN"}</span>
                        <Badge variant="outline" className="text-[9px] uppercase font-black px-1.5 py-0 h-4">{l.sex}</Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Select 
                          value={selectedTarget}
                          onValueChange={(val) => setTargetSectionMap(prev => ({ ...prev, [l.enrollmentApplicationId]: val }))}
                          disabled={isProcessing}
                        >
                          <SelectTrigger className="w-[180px] h-8 text-base font-bold bg-background">
                            <SelectValue placeholder="Select destination..." />
                          </SelectTrigger>
                          <SelectContent>
                            {compatibleSections.map((s: any) => (
                              <SelectItem key={s.id} value={String(s.id)} className="text-base font-bold uppercase">
                                {s.name} ({s.currentCount}/{s.maxCapacity})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="h-8 text-base font-bold uppercase"
                          disabled={!selectedTarget || isProcessing}
                          onClick={() => handleTransfer(l.enrollmentApplicationId, selectedTarget)}
                        >
                          {isProcessing && selectedTarget ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ArrowRightLeft className="h-3 w-3 mr-1" />}
                          Move
                        </Button>
                      </div>

                      <div className="w-px h-6 bg-border mx-1"></div>

                      <Button 
                        size="sm" 
                        variant="destructive" 
                        className="h-8 text-base font-bold uppercase"
                        disabled={isProcessing}
                        onClick={() => handleUnassign(l.enrollmentApplicationId)}
                        title="Return to Unassigned Pool"
                      >
                        {isProcessing && !selectedTarget ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserMinus className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
