import { useState } from "react";
import { 
  FileText, 
  Info, 
  AlertCircle, 
  CheckCircle2, 
  BookOpen, 
  Users, 
  UserPlus, 
  RefreshCw, 
  Stethoscope,
  ShieldCheck,
  Table as TableIcon,
  HelpCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function DocumentaryRequirements() {
  usePageTitle("Documentary Requirements Guide");

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Documentary Requirements</h1>
        <p className="text-muted-foreground">
          Reference guide for enrollment documents based on DepEd Order No. 017, s. 2025.
        </p>
      </div>

      <Alert className="bg-primary/5 border-primary/20">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <AlertTitle className="font-bold text-primary">Policy Update: DO 017, s. 2025</AlertTitle>
        <AlertDescription className="text-sm">
          This system follows the Revised Basic Education Enrollment Policy. PSA Birth Certificates are submitted <strong>once</strong> for the entire K-12 stay. No learner shall be refused enrollment due to missing documents.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Critical Rules
            </CardTitle>
            <CardDescription>Universal mandates for all grade levels</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 rounded-lg border bg-card">
                <h4 className="font-bold text-sm mb-2 flex items-center gap-2 text-primary">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px]">1</span>
                  Once-Only PSA Submission
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Birth Certificates are submitted only ONCE throughout K-12 (RA 11909). If already on file, do not request again.
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <h4 className="font-bold text-sm mb-2 flex items-center gap-2 text-primary">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px]">2</span>
                  Verification vs Collection
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Phase 1 (Early Reg): Verify only. Phase 2 (Actual Enrollment): Collect and file original documents.
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <h4 className="font-bold text-sm mb-2 flex items-center gap-2 text-primary">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px]">3</span>
                  No Refusal Policy
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Missing documents are NOT grounds for rejection. Enroll on a <strong>temporary basis</strong> until Aug 31.
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <h4 className="font-bold text-sm mb-2 flex items-center gap-2 text-primary">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px]">4</span>
                  SF10 Post-Enrollment
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  SF10 is NOT an initial requirement. It is transmitted school-to-school via LIS after enrollment is complete.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Prohibited Items
            </CardTitle>
            <CardDescription>Never require these for enrollment</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs">
              <li className="flex items-start gap-2 text-destructive">
                <span className="mt-1 font-bold">✕</span>
                <span>Enrollment or Processing Fees</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 font-bold">✕</span>
                <span>Good Moral Certificate</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 font-bold">✕</span>
                <span>Barangay Clearance</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 font-bold">✕</span>
                <span>Clearance from previous school</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 font-bold">✕</span>
                <span>Proof of payment from private school</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 font-bold">✕</span>
                <span>Medical certificate (standard enrollees)</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TableIcon className="h-5 w-5 text-primary" />
            Requirements Master Table
          </CardTitle>
          <CardDescription>Minimum requirements by grade level and learner type</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="jhs" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="jhs">Junior High (7-10)</TabsTrigger>
              <TabsTrigger value="shs">Senior High (11-12)</TabsTrigger>
              <TabsTrigger value="special">Special Categories</TabsTrigger>
            </TabsList>
            
            <TabsContent value="jhs" className="space-y-4">
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[120px]">Grade</TableHead>
                      <TableHead className="w-[150px]">Learner Type</TableHead>
                      <TableHead>Primary Requirements</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-bold">Grade 7</TableCell>
                      <TableCell><Badge variant="outline">New Enrollee</Badge></TableCell>
                      <TableCell className="text-xs">SF9 (Grade 6 Card) + PSA BC</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground italic">Verification in Phase 1, Collection in Phase 2</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold" rowSpan={2}>Grades 8-10</TableCell>
                      <TableCell><Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Continuing</Badge></TableCell>
                      <TableCell className="text-xs">Confirmation Slip (Annex C)</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground italic">Auto-pre-registered in LIS</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Transferee</Badge></TableCell>
                      <TableCell className="text-xs">SF9 (Recent Card) + PSA BC</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground italic">Must undergo Phase 1 Early Reg</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="shs" className="space-y-4">
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[120px]">Grade</TableHead>
                      <TableHead className="w-[150px]">Learner Type</TableHead>
                      <TableHead>Primary Requirements</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-bold">Grade 11</TableCell>
                      <TableCell><Badge variant="outline">New Enrollee</Badge></TableCell>
                      <TableCell className="text-xs">SF9 (Grade 10 Card) + PSA BC + BEEF (w/ Track/Cluster)</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground italic">STEM: Sci/Math grades â‰¥ 85 required</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold">Grade 12</TableCell>
                      <TableCell><Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Continuing</Badge></TableCell>
                      <TableCell className="text-xs">Confirmation Slip (Annex C)</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground italic">On file from Grade 11</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold">Any SHS</TableCell>
                      <TableCell><Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Transferee</Badge></TableCell>
                      <TableCell className="text-xs">SF9 (Recent Card) + PSA BC</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground italic">Registrar verifies strand compatibility</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="special" className="space-y-4">
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[150px]">Category</TableHead>
                      <TableHead>Primary Requirements</TableHead>
                      <TableHead>Secondary/Flexible Docs</TableHead>
                      <TableHead>Deadline</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-bold flex items-center gap-1.5">
                        <RefreshCw className="h-3 w-3 text-primary" />
                        Balik-Aral
                      </TableCell>
                      <TableCell className="text-xs">Any previous school record + PSA BC</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">School Cert or Brgy Cert for last grade attended</TableCell>
                      <TableCell className="text-xs">Flexible</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold flex items-center gap-1.5">
                        <Stethoscope className="h-3 w-3 text-primary" />
                        LWD / SPED
                      </TableCell>
                      <TableCell className="text-xs">Standard docs for grade level</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">PWD ID or Medical Evaluation (if available)</TableCell>
                      <TableCell className="text-xs">Non-blocking</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold flex items-center gap-1.5">
                        <UserPlus className="h-3 w-3 text-primary" />
                        PEPT / A&E
                      </TableCell>
                      <TableCell className="text-xs">Cert. of Rating / PPA Certificate + PSA BC</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">Secondary ID if PSA BC is missing</TableCell>
                      <TableCell className="text-xs">Oct 31 (BC)</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Secondary Identity Documents
            </CardTitle>
            <CardDescription>If PSA Birth Certificate is not available</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Accepted proof of identity for temporary enrollment (Deadline: Oct 31):</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  "Birth Cert (Late Registration)",
                  "Barangay Certification",
                  "Baptismal Certificate",
                  "Valid Passport",
                  "Certificate of Foundling",
                  "Government-issued ID",
                  "Affidavit of 2 Persons"
                ].map((doc) => (
                  <li key={doc} className="flex items-center gap-2 text-xs p-2 rounded border bg-muted/30">
                    <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                    {doc}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              School Forms Reference
            </CardTitle>
            <CardDescription>Official DepEd forms glossary</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { name: "SF9", desc: "Report Card (Formerly Form 138). Proof of promotion." },
                { name: "SF10", desc: "Permanent Record (Formerly Form 137). School-to-school." },
                { name: "BEEF", desc: "Basic Education Enrollment Form. The main data source." },
                { name: "Confirmation Slip", desc: "Annex C. For continuing learners' intent to enroll." },
              ].map((form) => (
                <div key={form.name} className="flex justify-between items-start border-b pb-2 last:border-0 last:pb-0">
                  <span className="text-xs font-bold bg-muted px-1.5 py-0.5 rounded">{form.name}</span>
                  <span className="text-[11px] text-muted-foreground text-right max-w-[200px]">{form.desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-4 border-t">
        <p>Source: DepEd Order No. 017, s. 2025</p>
        <p>Last Updated: March 2026</p>
      </div>
    </div>
  );
}
