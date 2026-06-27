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
import { useRetainedSheetValue } from "@/shared/hooks/useRetainedSheetValue";

interface AdvisoryLearner {
  lrn: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  sex: string;
  streetAddress: string | null;
  barangay: string | null;
  cityMunicipality: string | null;
  province: string | null;
  contactNumber: string | null;
  guardianName: string | null;
  guardianContact: string | null;
  guardianRelationship: string | null;
}

interface AdvisoryRecord {
  id: number;
  enrollmentApplication: {
    learner: AdvisoryLearner;
  };
}

interface AdvisorySection {
  name: string;
  gradeLevel: {
    displayOrder: number;
  };
}

interface AdvisoryResponse {
  section?: AdvisorySection | null;
  records?: AdvisoryRecord[];
}

export default function AdvisoryClass() {
  const [selectedLearner, setSelectedLearner] = useState<AdvisoryLearner | null>(null);
  const retainedLearner = useRetainedSheetValue(selectedLearner);

  const { data, isLoading } = useQuery({
    queryKey: ["teacher", "advisory"],
    queryFn: () => api.get<AdvisoryResponse>("/teacher-eosy/advisory").then(res => res.data),
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
        <h1 className="text-2xl font-extrabold tracking-tight">My Advisory Class</h1>
        <p className="text-muted-foreground">
          View your currently assigned advisory class and enrolled learners.
        </p>
      </div>

      {!section ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground shadow-sm">
          <p className="text-lg  text-foreground">No Active Advisory Section</p>
          <p className="mt-1">You are not currently assigned as an adviser to any section for this school year.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="border-b p-6">
            <h2 className="text-lg ">
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
                {records?.map((record, idx) => {
                  const learner = record.enrollmentApplication.learner;
                  return (
                    <TableRow
                      key={record.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedLearner(learner)}
                    >
                      <TableCell className="text-muted-foreground  text-left">{idx + 1}</TableCell>
                      <TableCell className="font-extrabold text-left uppercase">
                        {learner.lastName}, {learner.firstName}
                      </TableCell>
                      <TableCell className="text-left uppercase ">{learner.sex}</TableCell>
                      <TableCell className="text-muted-foreground font-extrabold text-left">{learner.lrn || "NO LRN"}</TableCell>
                    </TableRow>
                  );
                })}
                {records?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground ">
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
            <SheetTitle className="text-2xl font-extrabold uppercase tracking-tight text-primary">Learner Profile</SheetTitle>
            <SheetDescription className="font-extrabold">
              Basic DepEd profile and emergency contact information.
            </SheetDescription>
          </SheetHeader>

          {retainedLearner && (
            <div className="mt-8 space-y-8">
              <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border">
                <div className="h-16 w-16 bg-primary/10 text-primary flex items-center justify-center rounded-full shrink-0">
                  <UserSquare className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold uppercase text-foreground leading-tight">
                    {retainedLearner.lastName}, {retainedLearner.firstName} {retainedLearner.middleName}
                  </h3>
                  <p className="text-base leading-tight font-extrabold text-muted-foreground mt-1">
                    LRN: {retainedLearner.lrn || "Not Assigned"}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-extrabold text-base leading-tight uppercase text-primary/80 tracking-wide">Contact & Address</h4>
                <div className="bg-card border border-border rounded-xl p-4 space-y-4 shadow-sm">
                  <div className="flex items-start gap-3 text-base leading-tight">
                    <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className=" text-foreground leading-relaxed">
                      {retainedLearner.streetAddress || "No street address"}, {retainedLearner.barangay}, {retainedLearner.cityMunicipality}, {retainedLearner.province}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-base leading-tight">
                    <Phone className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-extrabold text-foreground">
                      {retainedLearner.contactNumber || "No contact number"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-extrabold text-base leading-tight uppercase text-primary/80 tracking-wide">Guardian Info</h4>
                <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
                  <div>
                    <p className="text-base font-extrabold text-muted-foreground uppercase tracking-normal mb-1">Name</p>
                    <p className="font-extrabold text-foreground">{retainedLearner.guardianName || "No guardian listed"}</p>
                  </div>
                  <div>
                    <p className="text-base font-extrabold text-muted-foreground uppercase tracking-normal mb-1">Contact</p>
                    <p className="font-extrabold text-foreground">{retainedLearner.guardianContact || "No contact provided"}</p>
                  </div>
                  {retainedLearner.guardianRelationship && (
                    <div>
                      <p className="text-base font-extrabold text-muted-foreground uppercase tracking-normal mb-1">Relationship</p>
                      <p className="font-extrabold text-foreground capitalize">{retainedLearner.guardianRelationship}</p>
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
