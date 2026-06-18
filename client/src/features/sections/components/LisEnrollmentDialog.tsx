import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";
import {
  Search,
  UserPlus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { sileo } from "sileo";
import { useSettingsStore } from "@/store/settings.slice";
import { format } from "date-fns";

interface ProspectiveEnrolee {
  id: number;
  enrollmentApplicationId: number;
  lrn: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  sex: string;
  learnerType: string;
  applicantType: string;
  status: string;
  isTemporarilyEnrolled: boolean;
  checklist: {
    isPsaBirthCertPresented: boolean;
    isSf9Submitted: boolean;
    isConfirmationSlipReceived: boolean;
  } | null;
}

interface SearchLearner {
  id: number;
  lrn: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  sex: string;
  enrollmentApplicationId: number | null;
  isTemporarilyEnrolled: boolean;
  status: string | null;
}

interface LisEnrollmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: number | null;
  sectionName: string;
  onEnrollSuccess: () => void;
}

export function LisEnrollmentDialog({
  open,
  onOpenChange,
  sectionId,
  sectionName,
  onEnrollSuccess,
}: LisEnrollmentDialogProps) {
  const { activeSchoolYearId } = useSettingsStore();

  // Dialog State
  const [activeTab, setActiveTab] = useState<string>("prospective");
  const [loading, setLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Tab 1: Prospective List
  const [prospectiveList, setProspectiveList] = useState<ProspectiveEnrolee[]>([]);
  const [selectedAppIds, setSelectedAppIds] = useState<number[]>([]);

  // Tab 2: Walk-In / Transferee Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SearchLearner[]>([]);
  const [selectedSearchLearner, setSelectedSearchLearner] = useState<SearchLearner | null>(null);

  // Enrollment configuration parameters (per DepEd LIS guidelines)
  const [officialEnrollmentDate, setOfficialEnrollmentDate] = useState<string>(() =>
    format(new Date(), "yyyy-MM-dd")
  );
  const [isCapacityOverride, setIsCapacityOverride] = useState<boolean>(false);

  // 1. Fetch prospective enrolees
  const fetchProspective = useCallback(async () => {
    if (!sectionId || !activeSchoolYearId) return;
    setLoading(true);
    try {
      const res = await api.get<{ prospective: ProspectiveEnrolee[] }>(
        `/sections/${sectionId}/prospective-enrolees`,
        {
          params: { schoolYearId: activeSchoolYearId },
        }
      );
      setProspectiveList(res.data.prospective);
      setSelectedAppIds([]);
    } catch (err: unknown) {
      console.error("Failed to load prospective list:", err);
      sileo.error({
        title: "Load Error",
        description: "Failed to retrieve the prospective list of enrolees.",
      });
    } finally {
      setLoading(false);
    }
  }, [sectionId, activeSchoolYearId]);

  // 2. Search walk-ins / transferees
  const handleSearch = useCallback(async (query: string) => {
    if (!sectionId) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get<{ learners: SearchLearner[] }>(
        `/sections/${sectionId}/search-prospective`,
        {
          params: { q: trimmed },
        }
      );
      setSearchResults(res.data.learners);
    } catch (err: unknown) {
      console.error("Search failed:", err);
      sileo.error({
        title: "Search Error",
        description: "An error occurred while searching learners.",
      });
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  // Handle Tab Switch & Reset
  useEffect(() => {
    if (open && sectionId) {
      void fetchProspective();
      setSearchQuery("");
      setSearchResults([]);
      setSelectedSearchLearner(null);
      setIsCapacityOverride(false);
      setOfficialEnrollmentDate(format(new Date(), "yyyy-MM-dd"));
    }
  }, [open, sectionId, fetchProspective]);

  // Checkbox functions
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAppIds(prospectiveList.map((p) => p.enrollmentApplicationId));
    } else {
      setSelectedAppIds([]);
    }
  };

  const handleToggleSelect = (appId: number, checked: boolean) => {
    if (checked) {
      setSelectedAppIds((prev) => [...prev, appId]);
    } else {
      setSelectedAppIds((prev) => prev.filter((id) => id !== appId));
    }
  };

  // Perform bulk enrollment for prospective list
  const handleEnrollSelected = async () => {
    if (!sectionId || selectedAppIds.length === 0 || !activeSchoolYearId) return;
    setIsSubmitting(true);
    try {
      await api.post(`/sections/${sectionId}/enroll-prospective`, {
        applicationIds: selectedAppIds,
        officialEnrollmentDate,
        isCapacityOverride,
        schoolYearId: activeSchoolYearId,
      });

      sileo.success({
        title: "Prospective Learners Enrolled",
        description: `Successfully enrolled ${selectedAppIds.length} continuing learner(s) in LIS. SF1 Roster updated.`,
      });

      onEnrollSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: { message?: string } };
      };
      const status = axiosErr?.response?.status;
      const msg = axiosErr?.response?.data?.message ?? "Failed to enroll selected learners.";

      if (status === 409) {
        sileo.error({
          title: "Section Capacity Overlimit",
          description: `${msg}. You may toggle Capacity Override if authorized.`,
        });
      } else {
        sileo.error({
          title: "Enrollment Failed",
          description: msg,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Perform single enrollment for transferee search result
  const handleEnrollSingle = async () => {
    if (!sectionId || !selectedSearchLearner || !activeSchoolYearId) return;
    setIsSubmitting(true);
    try {
      const isAppBased = selectedSearchLearner.enrollmentApplicationId !== null;
      const payload = isAppBased
        ? {
            applicationIds: [selectedSearchLearner.enrollmentApplicationId],
            officialEnrollmentDate,
            isCapacityOverride,
            schoolYearId: activeSchoolYearId,
          }
        : {
            learnerIds: [selectedSearchLearner.id],
            officialEnrollmentDate,
            isCapacityOverride,
            schoolYearId: activeSchoolYearId,
          };

      await api.post(`/sections/${sectionId}/enroll-prospective`, payload);

      sileo.success({
        title: "Learner Enrolled",
        description: `Successfully enrolled ${selectedSearchLearner.lastName}, ${selectedSearchLearner.firstName} into ${sectionName}.`,
      });

      onEnrollSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: { message?: string } };
      };
      const status = axiosErr?.response?.status;
      const msg = axiosErr?.response?.data?.message ?? "Failed to enroll learner.";

      if (status === 409) {
        sileo.error({
          title: "Section Capacity Overlimit",
          description: `${msg}. You may toggle Capacity Override if authorized.`,
        });
      } else {
        sileo.error({
          title: "Enrollment Failed",
          description: msg,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden border-none shadow-2xl backdrop-blur-md bg-white/95 rounded-2xl">
        {/* Header with gradient strip */}
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black uppercase text-slate-800 tracking-wide">
                LIS Learner Enrollment
              </DialogTitle>
              <p className="text-base font-bold text-slate-500 uppercase mt-0.5">
                Class: <span className="text-emerald-700 font-extrabold">{sectionName}</span>
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs & Content */}
        <Tabs defaultValue="prospective" onValueChange={setActiveTab} className="w-full">
          <div className="px-6 pt-2 bg-slate-50/50 border-b border-slate-100">
            <TabsList className="bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <TabsTrigger
                value="prospective"
                className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white font-bold text-base uppercase px-4"
              >
                Prospective List
              </TabsTrigger>
              <TabsTrigger
                value="search"
                className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white font-bold text-base uppercase px-4"
              >
                Search & Enrol Transferees
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Prospective List Tab */}
          <TabsContent value="prospective" className="mt-0 outline-none">
            <div className="max-h-[350px] min-h-[250px] overflow-y-auto px-6 py-4">
              {loading && prospectiveList.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                  <p className="text-base font-black uppercase tracking-widest text-slate-500 animate-pulse">
                    Scanning LIS prospective pool...
                  </p>
                </div>
              ) : prospectiveList.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <AlertCircle className="h-10 w-10 text-slate-300 mb-3" />
                  <p className="text-base leading-tight font-bold text-slate-700">No prospective enrolees found</p>
                  <p className="text-base text-slate-500 mt-1 max-w-sm">
                    No unsectioned rolled-over or pre-registered continuing students match this grade level's program type in this school year.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                  <table className="w-full text-left border-collapse text-base leading-tight">
                    <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-wide text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4 w-12 text-center">
                          <Checkbox
                            checked={selectedAppIds.length === prospectiveList.length}
                            onCheckedChange={handleSelectAll}
                          />
                        </th>
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">LRN</th>
                        <th className="py-2.5 px-3 text-center">Sex</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {prospectiveList.map((app) => (
                        <tr
                          key={app.enrollmentApplicationId}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="py-2 px-4 text-center">
                            <Checkbox
                              checked={selectedAppIds.includes(app.enrollmentApplicationId)}
                              onCheckedChange={(checked) =>
                                handleToggleSelect(app.enrollmentApplicationId, !!checked)
                              }
                            />
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-800">
                            {app.lastName.toUpperCase()}, {app.firstName}
                            {app.middleName ? ` ${app.middleName.charAt(0)}.` : ""}
                          </td>
                          <td className="py-2 px-3 font-mono text-base">{app.lrn || "PENDING"}</td>
                          <td className="py-2 px-3 text-center text-base font-bold">
                            {app.sex === "MALE" ? "M" : "F"}
                          </td>
                          <td className="py-2 px-3 text-base">
                            <Badge variant="secondary" className="text-[10px] font-bold">
                              {app.learnerType}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-base">
                            {app.isTemporarilyEnrolled ? (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] font-bold">
                                Temporary
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                                Official
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Search & Enrol Transferees Tab */}
          <TabsContent value="search" className="mt-0 outline-none">
            <div className="max-h-[350px] min-h-[250px] overflow-y-auto px-6 py-4 space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by Learner Reference Number (LRN) or Name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 font-bold border-slate-200 shadow-sm focus-visible:ring-emerald-500/20"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleSearch(searchQuery);
                    }}
                  />
                </div>
                <Button
                  onClick={() => void handleSearch(searchQuery)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 uppercase text-base"
                >
                  Search
                </Button>
              </div>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
                  <p className="text-[11px] font-bold uppercase text-slate-400 tracking-wide">
                    Querying LIS Database...
                  </p>
                </div>
              ) : selectedSearchLearner ? (
                /* Single Learner Selected Details Form */
                <div className="p-4 rounded-xl border-2 border-emerald-100 bg-emerald-50/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-emerald-600/10 flex items-center justify-center text-emerald-700 border-2 border-emerald-600/20">
                        <span className="text-base leading-tight font-black uppercase">
                          {selectedSearchLearner.lastName[0]}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-black text-base uppercase text-slate-800 leading-none">
                          {selectedSearchLearner.lastName}, {selectedSearchLearner.firstName}
                        </h4>
                        <p className="text-[10px] font-black text-slate-500 uppercase mt-1">
                          LRN: {selectedSearchLearner.lrn || "PENDING"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedSearchLearner(null)}
                      className="text-base font-bold uppercase text-slate-500 hover:text-slate-800"
                    >
                      Clear Selection
                    </Button>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200/60 shadow-sm flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <p className="text-[11px] leading-relaxed text-slate-600 font-bold">
                      {selectedSearchLearner.enrollmentApplicationId
                        ? "This learner has an active BEEF application. Enrollment will section them instantly."
                        : "Walk-in transferee has no active application in the current school year. Enrolling will auto-generate their BEEF record."}
                    </p>
                  </div>
                </div>
              ) : searchResults.length === 0 ? (
                searchQuery.trim() ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center">
                    <AlertCircle className="h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-base leading-tight font-bold text-slate-700">No unsectioned matches found</p>
                    <p className="text-base text-slate-500 mt-1">
                      Try adjusting your query or verify if this learner is already enrolled in another section.
                    </p>
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400">
                    <Search className="h-8 w-8 opacity-40 mb-2" />
                    <p className="text-base font-bold">Enter LRN or student last name to search LIS</p>
                  </div>
                )
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white max-h-[220px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-base leading-tight">
                    <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-wide text-slate-600 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-3">LRN</th>
                        <th className="py-2 px-3 text-center">Sex</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {searchResults.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3 font-bold text-slate-800">
                            {l.lastName.toUpperCase()}, {l.firstName}
                            {l.middleName ? ` ${l.middleName.charAt(0)}.` : ""}
                          </td>
                          <td className="py-2 px-3 font-mono text-base">{l.lrn || "PENDING"}</td>
                          <td className="py-2 px-3 text-center text-base font-bold">
                            {l.sex === "MALE" ? "M" : "F"}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedSearchLearner(l)}
                              className="text-[10px] font-bold h-7 uppercase bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            >
                              Select
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Global Enrollment Controls Section */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-600">
              Official Enrollment Date *
            </label>
            <input
              type="date"
              value={officialEnrollmentDate}
              max={format(new Date(), "yyyy-MM-dd")}
              onChange={(e) => setOfficialEnrollmentDate(e.target.value)}
              className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-base font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-col justify-center space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-600 flex items-center gap-1.5">
              <span>Section Capacity Override</span>
            </label>
            <div className="flex items-center gap-2">
              <Checkbox
                id="capacity-override"
                checked={isCapacityOverride}
                onCheckedChange={(checked) => setIsCapacityOverride(!!checked)}
              />
              <label
                htmlFor="capacity-override"
                className="text-[11px] font-bold text-slate-600 cursor-pointer select-none"
              >
                Allow override if section is overlimit
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-slate-100 flex items-center justify-between sm:justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[10px] font-extrabold uppercase bg-white border-slate-200/80">
              LIS Sync: Active
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="font-bold uppercase text-base border-slate-200"
            >
              Cancel
            </Button>
            {activeTab === "prospective" ? (
              <Button
                disabled={selectedAppIds.length === 0 || isSubmitting}
                onClick={handleEnrollSelected}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base uppercase px-6"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Enrol Selected ({selectedAppIds.length})
              </Button>
            ) : (
              <Button
                disabled={!selectedSearchLearner || isSubmitting}
                onClick={handleEnrollSingle}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base uppercase px-6"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Enrol Selected Student
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
