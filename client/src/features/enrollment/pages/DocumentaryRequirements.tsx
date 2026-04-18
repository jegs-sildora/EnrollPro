import {
  AlertCircle,
  CheckCircle2,
  BookOpen,
  UserPlus,
  RefreshCw,
  Stethoscope,
  ShieldCheck,
  Table as TableIcon,
  HelpCircle,
  Clock,
  ClipboardCheck,
  Info,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Badge } from "@/shared/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { usePageTitle } from "@/shared/hooks/usePageTitle";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { useMemo } from "react";

export default function DocumentaryRequirements() {
  usePageTitle();

  const phaseColumns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        accessorKey: "feature",
        header: "",
        cell: ({ row }) => (
          <span className="font-bold text-sm bg-muted/20 block p-1">
            {row.original.feature}
          </span>
        ),
      },
      {
        accessorKey: "phase1",
        header: () => (
          <div className="bg-blue-50/50 text-blue-700 font-bold p-1">
            Phase 1 — Basic Education Early Registration Form
          </div>
        ),
        cell: ({ row }) => (
          <span className={`text-sm ${row.original.phase1Class ?? ""}`}>
            {row.original.phase1}
          </span>
        ),
      },
      {
        accessorKey: "phase2",
        header: () => (
          <div className="bg-emerald-50/50 text-emerald-700 font-bold p-1">
            Phase 2 — Actual Enrollment
          </div>
        ),
        cell: ({ row }) => (
          <span className={`text-sm ${row.original.phase2Class ?? ""}`}>
            {row.original.phase2}
          </span>
        ),
      },
    ],
    [],
  );

  const phaseData = [
    {
      feature: "Schedule",
      phase1: "Last Sat of Jan to Last Fri of Feb",
      phase2: "~1 week before class opening (June)",
    },
    {
      feature: "Target Learners",
      phase1: "Grade 7, Transferees, Balik-Aral",
      phase2: "All Learners (Grade 7 to 10)",
    },
    {
      feature: "Forms Required",
      phase1: "Basic Education Enrollment Form (BEEF)",
      phase1Class: "italic",
      phase2: "BEEF + Confirmation Slip (for pre-reg)",
    },
    {
      feature: "Document Handling",
      phase1: "Presented for verification only (not collected)",
      phase1Class: "font-medium text-blue-600",
      phase2: "Original documents submitted and filed",
      phase2Class: "font-medium text-emerald-600",
    },
    {
      feature: "System Status",
      phase1: <Badge variant="outline">READY FOR ENROLLMENT</Badge>,
      phase2: <Badge>OFFICIALLY ENROLLED</Badge>,
    },
  ];

  const jhsColumns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        accessorKey: "grade",
        header: "Grade",
        cell: ({ row }) => (
          <span className="font-bold text-center block">
            {row.original.grade}
          </span>
        ),
      },
      {
        accessorKey: "type",
        header: "Learner Type",
        cell: ({ row }) => row.original.type,
      },
      {
        accessorKey: "phase1",
        header: () => (
          <div className="bg-blue-50/30 p-1">
            Phase 1: Basic Education Early Registration Form
          </div>
        ),
        cell: ({ row }) => (
          <span className={`text-xs ${row.original.phase1Class ?? ""}`}>
            {row.original.phase1}
          </span>
        ),
      },
      {
        accessorKey: "phase2",
        header: () => (
          <div className="bg-emerald-50/30 p-1">Phase 2: Actual Enrollment</div>
        ),
        cell: ({ row }) => (
          <span className="text-xs font-medium">{row.original.phase2}</span>
        ),
      },
    ],
    [],
  );

  const jhsData = [
    {
      grade: "7",
      type: <Badge variant="outline">New Enrollee</Badge>,
      phase1: "SF9 Grade 6 (verify) + PSA BC (verify)",
      phase2: "BEEF + SF9 Grade 6 + PSA BC + Privacy Consent",
    },
    {
      grade: "8-10",
      type: (
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 border-green-200">
          Continuing
        </Badge>
      ),
      phase1: "Not Required (Automatically ready for enrollment)",
      phase1Class: "text-muted-foreground italic",
      phase2: "Confirmation Slip (Annex C) only",
    },
    {
      grade: "8-10",
      type: (
        <Badge
          variant="outline"
          className="bg-blue-50 text-blue-700 border-blue-200">
          Transferee
        </Badge>
      ),
      phase1: "SF9 most recent (verify) + PSA BC (verify)",
      phase2: "BEEF + SF9 original + PSA BC + Privacy Consent",
    },
  ];

  const specialColumns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => row.original.category,
      },
      {
        accessorKey: "phase1",
        header: () => (
          <div className="bg-blue-50/30 p-1">
            Phase 1: Basic Education Early Registration Form
          </div>
        ),
        cell: ({ row }) => (
          <span className="text-xs">{row.original.phase1}</span>
        ),
      },
      {
        accessorKey: "phase2",
        header: () => (
          <div className="bg-emerald-50/30 p-1">Phase 2: Actual Enrollment</div>
        ),
        cell: ({ row }) => (
          <span className="text-xs font-medium">{row.original.phase2}</span>
        ),
      },
    ],
    [],
  );

  const specialData = [
    {
      category: (
        <div className="font-bold flex items-center gap-1.5">
          <RefreshCw className="h-3 w-3 text-primary" />
          Balik-Aral
        </div>
      ),
      phase1: "Any academic record (verify) + PSA BC (verify)",
      phase2: "BEEF + Available academic records + PSA BC",
    },
    {
      category: (
        <div className="font-bold flex items-center gap-1.5">
          <Stethoscope className="h-3 w-3 text-primary" />
          LWD / SPED
        </div>
      ),
      phase1: "Standard docs + Medical diagnosis (if avail)",
      phase2: "Standard docs + PWD ID/Medical Eval (optional)",
    },
    {
      category: (
        <div className="font-bold flex items-center gap-1.5">
          <UserPlus className="h-3 w-3 text-primary" />
          PEPT / A&E
        </div>
      ),
      phase1: "Cert. of Rating / PPA Cert + PSA BC (verify)",
      phase2: "BEEF + Cert. of Rating + PSA BC",
    },
  ];

  return (
    <div className="space-y-6 w-full max-w-[1600px] mx-auto pb-10 px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Documentary Requirements Guide
        </h1>
        <p className="text-muted-foreground">
          Official reference for enrollment documents based on DepEd Order No.
          017, s. 2025.
        </p>
      </div>

      <Alert className="bg-primary/5 border-primary/20">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <AlertTitle className="font-bold text-primary">
          Policy Update: DO 017, s. 2025
        </AlertTitle>
        <AlertDescription className="text-sm">
          This system follows the Revised Basic Education Enrollment Policy. PSA
          Birth Certificates are submitted <strong>once</strong> for the entire
          K-12 stay. No learner shall be refused enrollment due to missing
          documents.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Critical Rules
            </CardTitle>
            <CardDescription>
              Universal mandates for all grade levels
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 rounded-lg border bg-card">
                <h4 className="font-bold text-sm mb-2 flex items-center gap-2 text-primary">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[0.625rem]">
                    1
                  </span>
                  Once-Only PSA Submission
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Birth Certificates are submitted only ONCE throughout K-12 (RA
                  11909). If already on file, do not request again.
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <h4 className="font-bold text-sm mb-2 flex items-center gap-2 text-primary">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[0.625rem]">
                    2
                  </span>
                  Verification vs Collection
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Phase 1 (Early Reg): Verify only. Phase 2 (Actual Enrollment):
                  Collect and file original documents.
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <h4 className="font-bold text-sm mb-2 flex items-center gap-2 text-primary">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[0.625rem]">
                    3
                  </span>
                  No Refusal Policy
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Missing documents are NOT grounds for rejection. Enroll on a{" "}
                  <strong>temporary basis</strong> until Aug 31.
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <h4 className="font-bold text-sm mb-2 flex items-center gap-2 text-primary">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[0.625rem]">
                    4
                  </span>
                  SF10 Post-Enrollment
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  SF10 is NOT an initial requirement. It is transmitted
                  school-to-school via LIS after enrollment is complete.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              Prohibited Items
            </CardTitle>
            <CardDescription>
              Never require these for enrollment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-start gap-2 text-destructive font-bold">
                <span className="mt-0.5">✕</span>
                <span>Enrollment or Processing Fees</span>
              </li>
              {[
                "Good Moral Character Certificate",
                "Barangay Clearance",
                "Clearance from previous school",
                "Proof of payment (private school)",
                "Medical certificate (standard)",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-muted-foreground">
                  <span className="mt-0.5 font-bold">✕</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Comparison of Phases */}
      <Card className="border-primary/20 shadow-sm overflow-hidden">
        <div className="bg-primary/5 p-4 border-b border-primary/10">
          <CardTitle className="text-lg flex items-center gap-2 text-primary">
            <Clock className="h-5 w-5" />
            The Two Enrollment Phases
          </CardTitle>
        </div>
        <CardContent className="p-0">
          <DataTable
            columns={phaseColumns}
            data={phaseData}
            className="border-none rounded-none"
            tableClassName="table-fixed"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TableIcon className="h-5 w-5 text-primary" />
            Comprehensive Requirements Master Table
          </CardTitle>
          <CardDescription>
            Minimum requirements categorized by enrollment phase
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="jhs" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="jhs">Junior High (7-10)</TabsTrigger>
              <TabsTrigger value="special">Special Categories</TabsTrigger>
            </TabsList>

            <TabsContent value="jhs" className="space-y-4">
              <DataTable
                columns={jhsColumns}
                data={jhsData}
                className="rounded-md border overflow-hidden"
              />
            </TabsContent>

            <TabsContent value="special" className="space-y-4">
              <DataTable
                columns={specialColumns}
                data={specialData}
                className="rounded-md border overflow-hidden"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Secondary Identity Documents
            </CardTitle>
            <CardDescription>
              Acceptable if PSA Birth Certificate is not available
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert className="bg-amber-50 border-amber-200">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs text-amber-800">
                  Learners using secondary documents are{" "}
                  <strong>temporarily enrolled</strong>. The original PSA Birth
                  Certificate must be submitted by <strong>October 31</strong>.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  "Birth Cert (Late Registration)",
                  "Barangay Certification",
                  "Baptismal Certificate",
                  "Valid Passport",
                  "Certificate of Foundling",
                  "Any Government-issued ID",
                  "Affidavit of 2 Disinterested Persons",
                ].map((doc) => (
                  <div
                    key={doc}
                    className="flex items-center gap-2 text-xs p-2.5 rounded border bg-muted/20">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="font-medium">{doc}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              School Forms Reference
            </CardTitle>
            <CardDescription>
              Official DepEd terminology and usage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                {
                  name: "SF9",
                  desc: "Learner's Progress Report Card (Formerly Form 138). Issued per school year.",
                },
                {
                  name: "SF10",
                  desc: "Permanent Academic Record (Formerly Form 137). Cumulative history.",
                },
                {
                  name: "BEEF",
                  desc: "Basic Education Enrollment Form (Annex A). The primary data source.",
                },
                {
                  name: "Annex C",
                  desc: "Enrollment Confirmation Slip. Used by continuing learners to confirm intent.",
                },
              ].map((form) => (
                <div
                  key={form.name}
                  className="flex flex-col gap-1 p-3 rounded-lg border bg-card hover:bg-muted/10 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {form.name}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {form.desc}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Temporary Enrollment Section */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
            <UserPlus className="h-5 w-5" />
            Temporary Enrollment (DepEd Order No. 3, s. 2018)
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3 text-blue-900/80">
          <p>
            Learners with incomplete documentary requirements are{" "}
            <strong>not refused entry</strong>. They are marked as "Temporarily
            Enrolled" and may attend classes normally.
          </p>
          <ul className="list-disc pl-5 space-y-1 font-medium">
            <li>
              Cannot be promoted to the next grade level until requirements are
              complete.
            </li>
            <li>
              Cannot receive official certificates (SF9, SF10, Diploma) while
              temporary.
            </li>
            <li>
              Deadline for SF9 (Transferees): <strong>August 31</strong>.
            </li>
            <li>
              Deadline for PSA Birth Certificate: <strong>October 31</strong>.
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center text-[0.625rem] text-muted-foreground pt-4 border-t">
        <div className="flex gap-4">
          <p>Policy: DepEd Order No. 017, s. 2025</p>
          <p>Basis: RA 11909 (Once-Only PSA)</p>
        </div>
        <p>System Version 4.0 · March 2026</p>
      </div>
    </div>
  );
}
