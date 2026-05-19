import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { Progress } from "@/shared/ui/progress";
import axiosInstance from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import { ChevronRight, ChevronLeft, Loader2, Users, Archive } from "lucide-react";

interface Candidate {
  applicationId: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  lrn: string | null;
  sex: string;
  gradeLevel: string;
  gradeLevelId: number;
  tleProgram: string | null;
  tleProgramId: number | null;
}

interface Section {
  id: number;
  name: string;
  maxCapacity: number;
  gradeLevel: { id: number; name: string };
  tleProgram: { id: number; name: string } | null;
  tleProgramId: number | null;
}

/**
 * TleSectioningWorkspace: Split-pane UI for TLE student-to-section assignment.
 * Left Pane: Unsectioned candidates (auto-filtered by grade + tleProgramId)
 * Right Pane: Staged batch with telemetry
 * Route: /sectioning/tle
 */
export default function TleSectioningWorkspace() {
  const { isHistoricalReadOnly } = useHistoricalReadOnly();
  const [searchParams] = useSearchParams();
  const selectedSectionId = searchParams.get("sectionId");

  // State
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [stagedCandidates, setStagedCandidates] = useState<Candidate[]>([]);
  const [loadingPool, setLoadingPool] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // API: Fetch sections on mount
  useEffect(() => {
    if (!isHistoricalReadOnly) fetchSections();
  }, [isHistoricalReadOnly]);

  // Load pool when section changes
  useEffect(() => {
    if (selectedSection) {
      fetchCandidatePool(selectedSection.id);
    }
  }, [selectedSection]);

  // Filter candidates based on search term
  useEffect(() => {
    if (!selectedSection) return;

    const filtered = candidates.filter((candidate) => {
      const fullName =
        `${candidate.firstName} ${candidate.lastName}`.toLowerCase();
      const lrn = candidate.lrn?.toLowerCase() || "";
      const term = searchTerm.toLowerCase();

      return fullName.includes(term) || lrn.includes(term);
    });

    setFilteredCandidates(filtered);
  }, [searchTerm, candidates, selectedSection]);

  // API: Fetch sections
  const fetchSections = async () => {
    try {
      const { data } = await axiosInstance.get("/api/sectioning/sections-summary");
      setSections(data);

      if (selectedSectionId) {
        const found = data.find((s: Section) => s.id === Number(selectedSectionId));
        if (found) setSelectedSection(found);
      }
    } catch (error) {
      console.error("Failed to fetch sections:", error);
      sileo.error({ title: "Error", description: "Failed to load sections" });
    }
  };

  // API: Fetch candidate pool
  const fetchCandidatePool = async (sectionId: number) => {
    setLoadingPool(true);
    try {
      const section = sections.find((s) => s.id === sectionId);
      if (!section) return;

      const { data } = await axiosInstance.get("/api/sectioning/pool", {
        params: {
          gradeLevelId: section.gradeLevel.id,
          ...(section.tleProgram ? { tleProgramId: section.tleProgram.id } : {}),
        },
      });

      setCandidates(data);
      setFilteredCandidates(data);
      setStagedCandidates([]); // Reset staged
    } catch (error) {
      console.error("Failed to fetch candidate pool:", error);
      sileo.error({ title: "Error", description: "Failed to load candidate pool" });
    } finally {
      setLoadingPool(false);
    }
  };

  // Stage a candidate
  const stageCandidate = (candidate: Candidate) => {
    if (stagedCandidates.find((c) => c.applicationId === candidate.applicationId)) return;
    setStagedCandidates([...stagedCandidates, candidate]);
    setFilteredCandidates(filteredCandidates.filter((c) => c.applicationId !== candidate.applicationId));
  };

  // Unstage a candidate
  const unstageCandidate = (applicationId: number) => {
    const candidate = stagedCandidates.find((c) => c.applicationId === applicationId);
    if (!candidate) return;
    setStagedCandidates(stagedCandidates.filter((c) => c.applicationId !== applicationId));
    setFilteredCandidates([...filteredCandidates, candidate]);
  };

  // API: Submit assignment
  const submitAssignment = async () => {
    if (!selectedSection || stagedCandidates.length === 0) {
      sileo.error({ title: "Warning", description: "Select a section and stage at least one student" });
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await axiosInstance.post("/api/sectioning/tle/assign", {
        sectionId: selectedSection.id,
        applicationIds: stagedCandidates.map((c) => c.applicationId),
      });

      sileo.success({ title: "Success", description: data.message });
      setStagedCandidates([]);
      fetchCandidatePool(selectedSection.id);
    } catch (error: any) {
      console.error("Assignment failed:", error);
      sileo.error({ title: "Error", description: error.response?.data?.message || "Assignment failed" });
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate telemetry
  const currentEnrollment = selectedSection?.maxCapacity
    ? (stagedCandidates.length / selectedSection.maxCapacity) * 100
    : 0;
  const boys = stagedCandidates.filter((c) => c.sex === "MALE").length;
  const girls = stagedCandidates.filter((c) => c.sex === "FEMALE").length;

  if (isHistoricalReadOnly) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Archive className="h-12 w-12 text-slate-300" />
          <div className="text-center space-y-1">
            <p className="text-sm font-black uppercase text-slate-500">TLE Sectioning Unavailable</p>
            <p className="text-xs text-slate-400 font-bold max-w-sm">
              This workspace is only accessible for the active school year. Switch to the active year to manage TLE sectioning.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">TLE Track Sectioning</h1>
          <p className="text-muted-foreground mt-1">
            Assign students to TLE sections by program and track
          </p>
        </motion.div>

        {/* Section Selector */}
        {!selectedSection && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Select a Section</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {sections.map((section) => (
                    <Button
                      key={section.id}
                      variant="outline"
                      onClick={() => setSelectedSection(section)}
                      className="text-left h-auto p-3 flex flex-col items-start"
                    >
                      <span className="font-semibold text-foreground">{section.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {section.tleProgram?.name ?? "No TLE Program"}
                      </span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {selectedSection && (
          <>
            {/* Section Info Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-lg flex items-center justify-between"
            >
              <div>
                <h2 className="text-lg font-semibold text-foreground">{selectedSection.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedSection.gradeLevel.name} • {selectedSection.tleProgram?.name ?? "No TLE Program"}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedSection(null);
                  setStagedCandidates([]);
                  setSearchTerm("");
                }}
              >
                Change Section
              </Button>
            </motion.div>

            {/* Split Pane Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Left Pane: Unsectioned Candidates */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                <Card className="flex flex-col h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Available Candidates ({filteredCandidates.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    {/* Search */}
                    <Input
                      placeholder="Search by name or LRN..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="mb-4"
                    />

                    {/* Candidate List */}
                    {loadingPool ? (
                      <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
                      </div>
                    ) : (
                      <div className="space-y-2 flex-1 overflow-y-auto">
                        <AnimatePresence>
                          {filteredCandidates.length === 0 ? (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="flex items-center justify-center h-32 text-muted-foreground"
                            >
                              No available candidates
                            </motion.div>
                          ) : (
                            filteredCandidates.map((candidate, index) => (
                              <motion.div
                                key={candidate.applicationId}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border hover:border-amber-400 transition-colors"
                              >
                                <div className="flex-1">
                                  <p className="font-medium text-foreground">
                                    {candidate.firstName} {candidate.lastName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    LRN: {candidate.lrn || "N/A"}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 mr-1">
                                  <Badge
                                    variant="secondary"
                                    className={
                                      candidate.sex === "MALE"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-pink-100 text-pink-800"
                                    }
                                  >
                                    {candidate.sex === "MALE" ? "♂" : "♀"}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {candidate.gradeLevel}
                                  </Badge>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => stageCandidate(candidate)}
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </Button>
                              </motion.div>
                            ))
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Right Pane: Staged Batch */}
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <Card className="flex flex-col h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Staged Batch ({stagedCandidates.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    {/* Telemetry */}
                    <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-border">
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="text-foreground font-medium">Capacity</span>
                        <span className="text-muted-foreground">
                          {stagedCandidates.length} / {selectedSection.maxCapacity}
                        </span>
                      </div>
                      <Progress value={currentEnrollment} className="h-2 mb-3" />

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="inline-block w-2 h-2 bg-blue-500 rounded-full" />
                          <span className="text-slate-600">Boys: {boys}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="inline-block w-2 h-2 bg-pink-500 rounded-full" />
                          <span className="text-slate-600">Girls: {girls}</span>
                        </div>
                      </div>
                    </div>

                    {/* Staged List */}
                    <div className="space-y-2 flex-1 overflow-y-auto mb-4">
                      <AnimatePresence>
                        {stagedCandidates.length === 0 ? (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center justify-center h-32 text-muted-foreground"
                          >
                            No students staged yet
                          </motion.div>
                        ) : (
                          stagedCandidates.map((candidate, index) => (
                            <motion.div
                              key={candidate.applicationId}
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 10 }}
                              transition={{ delay: index * 0.05 }}
                              className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200"
                            >
                              <div className="flex-1">
                                <p className="font-medium text-foreground">
                                  {candidate.firstName} {candidate.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {candidate.lrn || "N/A"}
                                </p>
                              </div>
                              <Badge
                                variant="secondary"
                                className={
                                  candidate.sex === "MALE"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-pink-100 text-pink-800"
                                }
                              >
                                {candidate.sex === "MALE" ? "♂" : "♀"}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => unstageCandidate(candidate.applicationId)}
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </Button>
                            </motion.div>
                          ))
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-4 border-t border-border">
                      <Button
                        variant="outline"
                        onClick={() => setStagedCandidates([])}
                        disabled={stagedCandidates.length === 0}
                        className="flex-1"
                      >
                        Clear All
                      </Button>
                      <Button
                        onClick={submitAssignment}
                        disabled={stagedCandidates.length === 0 || submitting}
                        className="flex-1 bg-amber-600 hover:bg-amber-700"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Committing...
                          </>
                        ) : (
                          `Finalize & Commit (${stagedCandidates.length})`
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
