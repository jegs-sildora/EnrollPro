import { useEffect, useState, useMemo, startTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { DataTable } from "@/shared/ui/data-table";
import { Button } from "@/shared/ui/button";
import { useHeaderStore } from "@/store/header.slice";
import { Search, FolderOpen, FileText, Eye } from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { UserPhoto } from "@/shared/components/UserPhoto";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { cn, getGradeLevelButtonStyles } from "@/shared/lib/utils";
import { motion } from "motion/react";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Badge } from "@/shared/ui/badge";
import { PaginationBar } from "@/shared/components/PaginationBar";
import { usePaginationLimit } from "@/shared/hooks/usePaginationLimit";
import { useRealtimeRefresh } from "@/shared/hooks/useRealtimeRefresh";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { EarlyRegistrationReviewModal } from "./EarlyRegistrationReviewModal";
import { StudentDetailModal } from "@/features/students/components/StudentDetailModal";
import { useMutation } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { useAuthStore } from "@/store/auth.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { sileo } from "sileo";

type Learner = {
  id: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  lrn: string | null;
  studentPhoto: string | null;
  scpAdmissions?: { assessmentResult: string; program: string }[];
};

type GradeLevel = {
  name: string;
};

type EnrollmentPreviousSchool = {
  schoolName: string;
  generalAverage: number | null;
};

type ApplicationWithRelations = {
  id: number;
  status: string;
  createdAt: string;
  learner: Learner;
  gradeLevel: GradeLevel;
  previousSchool: EnrollmentPreviousSchool | null;
};

function getProgramAbbreviation(type?: string | null) {
  switch (type) {
    case "REGULAR": return "BEC";
    case "SCIENCE_TECHNOLOGY_AND_ENGINEERING": return "STE";
    case "SPECIAL_PROGRAM_IN_THE_ARTS": return "SPA";
    case "SPECIAL_PROGRAM_IN_SPORTS": return "SPS";
    case "SPECIAL_PROGRAM_IN_JOURNALISM": return "SPJ";
    case "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE": return "SPFL";
    case "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION": return "SPTVE";
    default: return type ?? "";
  }
}

export default function EarlyRegistrationMasterlist() {
  const setTitle = useHeaderStore((state: { setTitle: (title: string | null) => void }) => state.setTitle);
  const [selectedTab, setSelectedTab] = useState<"7" | "8-10">("7");
  const [filterTab, setFilterTab] = useState<"pending" | "enrolled" | "cancelled" | "all">("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "applicant", desc: false }]);
  const [selectedApplicationId, setSelectedApplicationId] = useState<number | null>(null);
  const [viewingLearnerId, setViewingLearnerId] = useState<number | null>(null);
  const [selectedLearnerForModal, setSelectedLearnerForModal] = useState<ApplicationWithRelations | null>(null);
  const [selectedLearnerForRestoreModal, setSelectedLearnerForRestoreModal] = useState<ApplicationWithRelations | null>(null);

  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = usePaginationLimit(50);
  
  const { user } = useAuthStore();
  const canMarkNoShow = user?.roles.some(r => r === "SYSTEM_ADMIN" || r === "HEAD_REGISTRAR" || r === "GRADE_LEVEL_COORDINATOR");

  const noShowMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.patch(`/applications/early-registration-masterlist/${id}/no-show`);
    },
    onSuccess: () => {
      sileo.success({ title: "Success", description: "Learner record marked as No Show." });
      setSelectedLearnerForModal(null);
      void queryClient.invalidateQueries({ queryKey: ["early-registrations"] });
    },
    onError: (error: any) => {
      toastApiError(error);
    }
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.patch(`/applications/early-registration-masterlist/${id}/restore`);
    },
    onSuccess: () => {
      sileo.success({ title: "Success", description: "Learner application restored to pending review." });
      setSelectedLearnerForRestoreModal(null);
      void queryClient.invalidateQueries({ queryKey: ["early-registrations"] });
    },
    onError: (error: any) => {
      toastApiError(error);
    }
  });

  useEffect(() => {
    setTitle("Early Registration Masterlist");
    return () => setTitle(null);
  }, [setTitle]);

  useRealtimeRefresh({
    topics: ["enrollment:applications", "students:list", "students:detail"],
    onRefresh: () => {
      void queryClient.invalidateQueries({ queryKey: ["early-registrations"] });
    },
  });

  const { data: applications = [], isLoading: isFetching } = useQuery<ApplicationWithRelations[]>({
    queryKey: ["early-registrations", selectedTab],
    queryFn: async () => {
      const { data } = await api.get<ApplicationWithRelations[]>("/applications/early-registration-masterlist", {
        params: { gradeLevel: selectedTab },
      });
      return data;
    },
  });

  const baseFilteredData = useMemo(() => {
    return applications.filter((app) => {
      const q = searchTerm.toLowerCase();
      const learner = app.learner;
      const fullName = `${learner.firstName} ${learner.lastName}`.toLowerCase();
      const lrn = learner.lrn || "";
      return fullName.includes(q) || lrn.includes(q);
    });
  }, [applications, searchTerm]);

  const filteredData = useMemo(() => {
    return baseFilteredData.filter((app) => {
      if (filterTab === "pending") {
         return app.status === "EARLY_REGISTRATION" || app.status === "PENDING_VERIFICATION";
      } else if (filterTab === "enrolled") {
         return app.status === "OFFICIALLY_ENROLLED" || app.status === "READY_FOR_SECTIONING";
      } else if (filterTab === "cancelled") {
         return app.status === "WITHDRAWN" || app.status === "DROPPED" || app.status === "ARCHIVED_NO_SHOW";
      }
      return true;
    });
  }, [baseFilteredData, filterTab]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredData.slice(start, start + limit);
  }, [filteredData, page, limit]);

  const columns: ColumnDef<ApplicationWithRelations>[] = [
    {
      id: "applicant",
      size: 380,
      minSize: 300,
      meta: { pin: "left" },
      header: ({ column }) => <DataTableColumnHeader column={column} title="LEARNER NAME & LRN" />,
      accessorFn: (row) => `${row.learner.lastName}, ${row.learner.firstName}`,
      cell: ({ row }) => {
        const application = row.original;
        const learner = application.learner;
        return (
          <div className="flex min-w-0 items-center gap-3 py-2 text-left">
            <UserPhoto
              photo={learner.studentPhoto}
              containerClassName="h-12 w-12 shrink-0 rounded-full border-2 border-primary shadow-sm"
            />
            <div className="min-w-0">
              <p className="truncate font-extrabold uppercase text-foreground">
                {learner.lastName}, {learner.firstName}
                {learner.middleName ? ` ${learner.middleName.charAt(0)}.` : ""}
              </p>
              <p className="text-sm text-foreground mb-1.5">
                LRN: {learner.lrn ?? "NO LRN YET"}
              </p>
              <div>
                {(() => {
                  const scpAdmissions = application.learner.scpAdmissions;
                  if (scpAdmissions && scpAdmissions.length > 0) {
                    const scp = scpAdmissions[0];
                    const acronym = getProgramAbbreviation(scp.program);
                    
                    if (scp.assessmentResult === "PENDING") {
                      return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 uppercase border border-purple-200 px-2 py-0">PENDING {acronym} RESULT</Badge>;
                    }
                    
                    if (scp.assessmentResult === "QUALIFIED" || scp.assessmentResult === "DISQUALIFIED") {
                      if (application.status === "EARLY_REGISTRATION" || application.status === "PENDING_VERIFICATION") {
                        const resultText = scp.assessmentResult === "DISQUALIFIED" ? "UNQUALIFIED" : "QUALIFIED";
                        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 uppercase border border-amber-200 px-2 py-0">{acronym} {resultText} — PENDING ENROLLMENT</Badge>;
                      }
                    }
                  }

                  if (application.status === "EARLY_REGISTRATION" || application.status === "PENDING_VERIFICATION") {
                    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 uppercase border border-amber-200 px-2 py-0">Pending Enrollment</Badge>;
                  }
                  if (application.status === "OFFICIALLY_ENROLLED") {
                    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 uppercase border border-emerald-200 px-2 py-0">Officially Enrolled</Badge>;
                  }
                  if (application.status === "READY_FOR_SECTIONING") {
                    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 uppercase border border-emerald-200 px-2 py-0">Ready for Sectioning</Badge>;
                  }
                  if (application.status === "WITHDRAWN" || application.status === "DROPPED" || application.status === "ARCHIVED_NO_SHOW") {
                    return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 uppercase border border-rose-200 px-2 py-0">{application.status.replace(/_/g, " ")}</Badge>;
                  }
                  return <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100 uppercase border border-slate-200 px-2 py-0">{application.status.replace(/_/g, " ")}</Badge>;
                })()}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: "previousSchool",
      size: 250,
      header: ({ column }) => <DataTableColumnHeader column={column} title="PREVIOUS SCHOOL" />,
      accessorFn: (row) => row.previousSchool?.schoolName || "N/A",
      cell: ({ getValue }) => (
        <span className="font-bold uppercase text-foreground truncate block">{getValue() as string}</span>
      ),
    },
    {
      id: "targetGrade",
      size: 150,
      header: ({ column }) => <DataTableColumnHeader column={column} title="TARGET GRADE" />,
      accessorFn: (row) => row.gradeLevel.name,
      cell: ({ getValue }) => (
        <span className="font-bold uppercase text-foreground">{getValue() as string}</span>
      ),
    },

    {
      id: "action",
      size: 150,
      meta: { pin: "right" },
      header: "ACTION",
      cell: ({ row }) => {
        const application = row.original;
        const isPending = application.status === "EARLY_REGISTRATION" || application.status === "PENDING_VERIFICATION";

        if (!isPending) {
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 items-center justify-center rounded-md px-4 transition-all border-2 font-bold cursor-pointer",
                  application.gradeLevel?.name 
                    ? getGradeLevelButtonStyles(application.gradeLevel.name)
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setViewingLearnerId(application.learner.id);
                }}>
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </Button>
              {canMarkNoShow && application.status === "ARCHIVED_NO_SHOW" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 data-[state=open]:bg-muted">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      className="text-primary font-bold uppercase cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLearnerForRestoreModal(application);
                      }}
                    >
                      Restore Application
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        }

        const isStrictlyPendingEnrollment = isPending && (!application.learner.scpAdmissions || application.learner.scpAdmissions.length === 0);

        return (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 items-center justify-center rounded-md px-4 transition-all border-2 font-bold cursor-pointer",
                application.gradeLevel?.name
                  ? getGradeLevelButtonStyles(application.gradeLevel.name)
                  : "bg-primary/5 text-primary border-primary hover:bg-primary hover:text-primary-foreground"
              )}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedApplicationId(row.original.id);
              }}>
              <Eye className="w-4 h-4 mr-2" />
              Review Form
            </Button>
            {canMarkNoShow && isStrictlyPendingEnrollment && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 data-[state=open]:bg-muted">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    className="text-primary font-bold uppercase cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLearnerForModal(application);
                    }}
                  >
                    Mark as No Show
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      },
    },
  ];

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center p-12 text-center h-full border-none w-full">
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
        <FolderOpen className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-2xl font-extrabold text-foreground">No Records Found</h3>
      <p className="text-muted-foreground mx-auto">
        No early registration records found for this category.
      </p>
    </div>
  );

  return (
    <div className="flex flex-1 h-full w-full min-h-0 flex-col">
      <Tabs value={selectedTab} onValueChange={(val: string) => { setSelectedTab(val as "7" | "8-10"); setPage(1); }} className="flex min-h-0 flex-1 flex-col w-full h-full">
        <TabsList className="w-full grid grid-cols-1 sm:grid-cols-2 h-auto gap-1 mb-4 p-1 bg-muted border border-border rounded-md relative shadow-sm">
          <TabsTrigger
            value="7"
            className="w-full font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-md"
          >
            {selectedTab === "7" && (
              <motion.div
                layoutId="er-active-pill"
                className="absolute inset-0 bg-primary shadow-sm rounded-md"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className={cn("relative z-20 text-base uppercase truncate", selectedTab === "7" ? "text-primary-foreground" : "text-foreground")}>
              Incoming Grade 7
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="8-10"
            className="w-full font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-md"
          >
            {selectedTab === "8-10" && (
              <motion.div
                layoutId="er-active-pill"
                className="absolute inset-0 bg-primary shadow-sm rounded-md"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className={cn("relative z-20 text-base uppercase truncate", selectedTab === "8-10" ? "text-primary-foreground" : "text-foreground")}>
              Grades 8-10 (Transferees)
            </span>
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 flex min-h-0 flex-col w-full max-h-[80vh]">
          <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col flex-1 h-full min-h-0 overflow-hidden">
            {(() => {
              const pendingCount = baseFilteredData.filter((app) => app.status === "EARLY_REGISTRATION" || app.status === "PENDING_VERIFICATION").length;
              const enrolledCount = baseFilteredData.filter((app) => app.status === "OFFICIALLY_ENROLLED").length;
              const cancelledCount = baseFilteredData.filter((app) => app.status === "WITHDRAWN" || app.status === "DROPPED" || app.status === "ARCHIVED_NO_SHOW").length;
              const allCount = baseFilteredData.length;

              const metrics = [
                { key: "pending", title: "Pending Review", value: pendingCount },
                { key: "enrolled", title: "Officially Enrolled", value: enrolledCount },
                { key: "cancelled", title: "Cancelled/No Show", value: cancelledCount },
                { key: "all", title: "All Registrants", value: allCount },
              ] as const;

              return (
                <div className="grid grid-cols-2 lg:grid-cols-4 h-auto min-h-10 border-b border-gray-200 bg-white shrink-0 md:divide-x md:divide-y-0 divide-y divide-gray-200">
                  {metrics.map((m) => {
                    const isActive = filterTab === m.key;
                    return (
                      <button
                        key={m.key}
                        onClick={() => { setFilterTab(m.key); setPage(1); }}
                        className={cn(
                          "relative flex items-center justify-between px-4 py-2 md:py-0 h-10 md:h-full transition-colors uppercase font-bold z-10",
                          isActive
                            ? "text-primary-foreground bg-primary"
                            : "text-foreground hover:bg-gray-50"
                        )}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="er-metric-pill"
                            className="absolute inset-0 bg-primary"
                            transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                          />
                        )}
                        <span className="relative z-20 whitespace-normal text-left break-words leading-snug text-xs sm:text-sm">{m.title}</span>
                        <span className={cn(
                          "ml-2 sm:ml-3 shrink-0 rounded-full px-2 py-0.5 text-xs sm:text-sm relative z-20 transition-colors",
                          isActive ? "bg-background text-primary" : "bg-primary text-primary-foreground"
                        )}>
                          {m.value}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
            
            <div className="flex flex-col xl:flex-row items-center gap-3 w-full bg-muted/20 border-border border-b p-3 sm:px-6">
              <div className="relative w-full flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="SEARCH LRN, FIRST NAME, LAST NAME..."
                  className="w-full h-12 pl-10 pr-12 bg-white border-gray-300 shadow-sm transition-shadow focus-visible:ring-primary uppercase font-bold"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    startTransition(() => {
                      setPage(1);
                    });
                  }}
                />
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden bg-background relative flex flex-col">
              <DataTable
                data={paginatedData}
                columns={columns}
                loading={isFetching}
                emptyStateContent={<EmptyState />}
                sorting={sorting}
                onSortingChange={setSorting}
              />
            </div>
            <PaginationBar
              total={filteredData.length}
              page={page}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={setLimit}
              itemName="Learners"
            />
          </Card>
        </div>
      </Tabs>

      <EarlyRegistrationReviewModal
        id={selectedApplicationId}
        onClose={() => setSelectedApplicationId(null)}
        onRefreshData={() => {
          void queryClient.invalidateQueries({ queryKey: ["early-registrations"] });
        }}
      />
      <StudentDetailModal 
        id={viewingLearnerId}
        onClose={() => setViewingLearnerId(null)}
        onRefreshData={() => {
          void queryClient.invalidateQueries({ queryKey: ["early-registrations"] });
        }}
      />
      <ConfirmationModal
        open={!!selectedLearnerForModal}
        onOpenChange={(open) => !open && setSelectedLearnerForModal(null)}
        title="Confirm Learner No-Show"
        description={
          selectedLearnerForModal 
            ? <>Are you sure you want to mark <strong>{selectedLearnerForModal.learner.lastName}, {selectedLearnerForModal.learner.firstName}</strong> (LRN: <strong>{selectedLearnerForModal.learner.lrn ?? "N/A"}</strong>) as No Show? This will move their early registration record to the Cancelled/No Show list. This action will not delete the historical application.</>
            : ""
        }
        onConfirm={() => selectedLearnerForModal && noShowMutation.mutate(selectedLearnerForModal.id)}
        confirmText="Yes, Mark as No Show"
        variant="danger"
        loading={noShowMutation.isPending}
      />
      <ConfirmationModal
        open={!!selectedLearnerForRestoreModal}
        onOpenChange={(open) => !open && setSelectedLearnerForRestoreModal(null)}
        title="Restore Application"
        description={
          selectedLearnerForRestoreModal 
            ? <>Are you sure you want to restore the application for <strong>{selectedLearnerForRestoreModal.learner.lastName}, {selectedLearnerForRestoreModal.learner.firstName}</strong> (LRN: <strong>{selectedLearnerForRestoreModal.learner.lrn ?? "N/A"}</strong>)? This will move the application back to the Pending Review queue.</>
            : ""
        }
        onConfirm={() => selectedLearnerForRestoreModal && restoreMutation.mutate(selectedLearnerForRestoreModal.id)}
        confirmText="Yes, Restore Application"
        loading={restoreMutation.isPending}
      />
    </div>
  );
}
