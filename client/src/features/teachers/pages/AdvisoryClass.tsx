import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import { Loader2, MapPin, Phone, UserSquare } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";

export default function AdvisoryClass() {
  const [selectedLearner, setSelectedLearner] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["teacher", "advisory"],
    queryFn: () => api.get("/teacher-eosy/advisory").then(res => res.data),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { section, records } = data || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Advisory Class</h1>
        <p className="text-muted-foreground">
          View your currently assigned advisory class and enrolled learners.
        </p>
      </div>

      {!section ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground shadow-sm">
          <p className="text-lg font-medium text-foreground">No Active Advisory Section</p>
          <p className="mt-1">You are not currently assigned as an adviser to any section for this school year.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="border-b p-6">
            <h2 className="text-lg font-medium">
              Grade {section.gradeLevel.displayOrder} - {section.name}
            </h2>
            <p className="text-base leading-tight text-muted-foreground">
              {records?.length || 0} Learners Enrolled
            </p>
          </div>
          <div className="p-0 sm:p-2">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-primary/90 border-b-0">
                  <TableHead className="text-left w-12">#</TableHead>
                  <TableHead className="text-left">Learner Name</TableHead>
                  <TableHead className="text-left w-24">Sex</TableHead>
                  <TableHead className="text-left w-48">LRN</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records?.map((record: any, idx: number) => {
                  const learner = record.enrollmentApplication.learner;
                  return (
                    <TableRow 
                      key={record.id} 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedLearner(learner)}
                    >
                      <TableCell className="text-muted-foreground font-medium text-left">{idx + 1}</TableCell>
                      <TableCell className="font-bold text-left uppercase">
                        {learner.lastName}, {learner.firstName}
                      </TableCell>
                      <TableCell className="text-left uppercase font-medium">{learner.sex}</TableCell>
                      <TableCell className="text-muted-foreground font-bold text-left">{learner.lrn || "NO LRN"}</TableCell>
                    </TableRow>
                  );
                })}
                {records?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground font-medium">
                      No learners found in this section.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Sheet open={!!selectedLearner} onOpenChange={(open) => !open && setSelectedLearner(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-2xl font-black uppercase tracking-tight text-primary">Learner Profile</SheetTitle>
            <SheetDescription className="font-bold">
              Basic DepEd profile and emergency contact information.
            </SheetDescription>
          </SheetHeader>
          
          {selectedLearner && (
            <div className="mt-8 space-y-8">
              <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border">
                <div className="h-16 w-16 bg-primary/10 text-primary flex items-center justify-center rounded-full shrink-0">
                  <UserSquare className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase text-foreground leading-tight">
                    {selectedLearner.lastName}, {selectedLearner.firstName} {selectedLearner.middleName}
                  </h3>
                  <p className="text-base leading-tight font-bold text-muted-foreground mt-1">
                    LRN: {selectedLearner.lrn || "Not Assigned"}
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-black text-base leading-tight uppercase text-primary/80 tracking-wide">Contact & Address</h4>
                <div className="bg-card border border-border rounded-xl p-4 space-y-4 shadow-sm">
                  <div className="flex items-start gap-3 text-base leading-tight">
                    <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="font-medium text-foreground leading-relaxed">
                      {selectedLearner.streetAddress || "No street address"}, {selectedLearner.barangay}, {selectedLearner.cityMunicipality}, {selectedLearner.province}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-base leading-tight">
                    <Phone className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-bold text-foreground">
                      {selectedLearner.contactNumber || "No contact number"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-black text-base leading-tight uppercase text-primary/80 tracking-wide">Guardian Info</h4>
                <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
                  <div>
                    <p className="text-base font-bold text-muted-foreground uppercase tracking-normal mb-1">Name</p>
                    <p className="font-bold text-foreground">{selectedLearner.guardianName || "No guardian listed"}</p>
                  </div>
                  <div>
                    <p className="text-base font-bold text-muted-foreground uppercase tracking-normal mb-1">Contact</p>
                    <p className="font-bold text-foreground">{selectedLearner.guardianContact || "No contact provided"}</p>
                  </div>
                  {selectedLearner.guardianRelationship && (
                    <div>
                      <p className="text-base font-bold text-muted-foreground uppercase tracking-normal mb-1">Relationship</p>
                      <p className="font-bold text-foreground capitalize">{selectedLearner.guardianRelationship}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
