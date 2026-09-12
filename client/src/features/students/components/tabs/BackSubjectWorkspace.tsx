import React, { useState } from "react";
import { FileX, ChevronDown } from "lucide-react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/table";
import { motion, AnimatePresence } from "motion/react";

interface BackSubjectWorkspaceProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  student: any;
  schoolYearId: number;
  onRefreshData?: () => void;
}

interface Deficiency {
  id: number;
  subject: string;
  gradeLevel: string;
  subjectCode: string;
  grade: number;
  status: string;
  schoolYear?: string;
}

const parseSubjectName = (rawString: string) => {
  let cleaned = rawString.replace(/_/g, " ");
  if (cleaned.toUpperCase().includes("DEVL")) {
    cleaned = cleaned.toUpperCase().replace("DEVL", "DEVELOPMENTAL");
  }
  
  // Convert to Title Case
  const titleCased = cleaned
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
    
  // Preserve DepEd acronyms
  if (titleCased.toUpperCase() === "TLE") return "TLE";
  if (titleCased.toUpperCase() === "MAPEH") return "MAPEH";
  if (titleCased.toUpperCase() === "EPP") return "EPP";
  if (titleCased.toUpperCase() === "ESP") return "ESP";
  
  return titleCased;
};

const getSecondaryDescription = (subject: string): string | null => {
  const upper = subject.toUpperCase();
  if (upper === "TLE") return "Technology and Livelihood Education";
  if (upper === "MAPEH") return "Music, Arts, Physical Education, and Health";
  if (upper === "EPP") return "Edukasyong Pantahanan at Pangkabuhayan";
  if (upper === "ESP") return "Edukasyon sa Pagpapakatao";
  return null;
};

export function BackSubjectWorkspace({ student }: BackSubjectWorkspaceProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  
  const deficiencies: Deficiency[] = student?.academicDeficiencies || [];

  const toggleRow = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="p-6 h-full flex flex-col bg-background overflow-y-auto">

      <div className="w-full flex flex-col gap-4 pb-20">
        {deficiencies.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-xl bg-muted/20">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileX className="h-8 w-8 text-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground">No Records Found</h3>
            <p className="text-muted-foreground mt-2 font-medium">
              This learner has no historical subject deficiencies.
            </p>
          </div>
        ) : (
          <div className="border rounded-md bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-extrabold text-foreground tracking-wider uppercase h-10">Learning Area</TableHead>
                  <TableHead className="font-extrabold text-foreground tracking-wider uppercase h-10 w-[180px]">School Year</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deficiencies.map((def) => {
                  const gradeNum = def.gradeLevel.replace("Grade ", "");
                  const parsedName = parseSubjectName(def.subject);
                  const primarySubjectText = `${parsedName} ${gradeNum}`;
                  const secondaryDesc = getSecondaryDescription(def.subject);
                  
                  const isExpanded = expandedId === def.id;

                  return (
                    <React.Fragment key={def.id}>
                      <TableRow 
                        className="hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => toggleRow(def.id)}
                      >
                        <TableCell className="align-middle">
                          <div className="flex items-center gap-3">
                            <div className="shrink-0 flex items-center justify-center h-6 w-6">
                              <motion.div
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                transition={{ duration: 0.25, ease: "easeInOut" }}
                              >
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              </motion.div>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-extrabold text-sm leading-tight uppercase text-foreground">
                                {primarySubjectText}
                              </span>
                              {secondaryDesc && (
                                <span className="text-xs text-muted-foreground mt-0.5">
                                  {secondaryDesc}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="align-middle">
                          <span className="font-extrabold text-sm text-foreground whitespace-nowrap">
                            {def.schoolYear ? (def.schoolYear.startsWith("S.Y.") ? def.schoolYear : `S.Y. ${def.schoolYear}`) : "N/A"}
                          </span>
                        </TableCell>
                      </TableRow>
                      
                      <TableRow className="bg-muted/10 hover:bg-muted/10 border-0">
                        <TableCell colSpan={2} className="p-0 border-0">
                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                key={`def-${def.id}`}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25, ease: "easeInOut" }}
                                className="overflow-hidden"
                              >
                                <div className="p-4 pl-[3.25rem] bg-muted/20 border-b">
                                  <div className="rounded-xl border bg-background overflow-hidden">
                                    <Table>
                                      <TableHeader className="bg-muted/30">
                                        <TableRow>
                                          <TableHead className="font-extrabold text-foreground tracking-wider uppercase h-10 w-1/4 text-center">Final Rating</TableHead>
                                          <TableHead className="font-extrabold text-foreground tracking-wider uppercase h-10 w-1/4 text-center">RCM</TableHead>
                                          <TableHead className="font-extrabold text-foreground tracking-wider uppercase h-10 w-1/4 text-center">RFG</TableHead>
                                          <TableHead className="font-extrabold text-foreground tracking-wider uppercase h-10 w-1/4 text-center">Outcome</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        <TableRow className="hover:bg-transparent">
                                          <TableCell className="align-middle text-center">
                                            {def.grade ?? "--"}
                                          </TableCell>
                                          <TableCell className="align-middle text-center">
                                            --
                                          </TableCell>
                                          <TableCell className="align-middle text-center">
                                            --
                                          </TableCell>
                                          <TableCell className="align-middle text-center">
                                            --
                                          </TableCell>
                                        </TableRow>
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
