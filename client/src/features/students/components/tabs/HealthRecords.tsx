import { useState } from "react";
import { Plus, Scale, Ruler, Info, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import type {
  ApplicantDetail,
  HealthRecord,
} from "@/features/enrollment/hooks/useApplicationDetail";
import { computeBmi, computeHfa } from "@/shared/constants/bmi";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { AddHealthRecord } from "../dialogs/AddHealthRecord";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { useMemo } from "react";

interface HealthRecordsProps {
  applicant: ApplicantDetail;
  onRefresh: () => void;
}

export function HealthRecords({ applicant, onRefresh }: HealthRecordsProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<HealthRecord | null>(
    null,
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.resolve(onRefresh());
    } finally {
      setIsRefreshing(false);
    }
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }
    return age;
  };

  const age = calculateAge(applicant.birthDate);
  const sex = applicant.sex as "Male" | "Female";

  const sortedRecords = [...(applicant.healthRecords || [])].sort(
    (a, b) =>
      new Date(b.assessmentDate).getTime() -
      new Date(a.assessmentDate).getTime(),
  );

  const latestRecord = sortedRecords[0];

  const columns = useMemo<ColumnDef<HealthRecord>[]>(
    () => [
      {
        id: "schoolYear",
        header: "School Year",
        cell: ({ row }) => (
          <span className="font-medium text-left block">
            {row.original.schoolYear?.yearLabel || "N/A"}
          </span>
        ),
      },
      {
        id: "period",
        header: "Period",
        cell: ({ row }) => (
          <div className="flex justify-center">
            <Badge variant="outline">{row.original.assessmentPeriod}</Badge>
          </div>
        ),
      },
      {
        id: "date",
        header: "Date",
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap block text-center">
            {format(new Date(row.original.assessmentDate), "MMM d, yyyy")}
          </span>
        ),
      },
      {
        id: "weight",
        header: "Weight",
        cell: ({ row }) => (
          <span className="text-center block">{row.original.weightKg} kg</span>
        ),
      },
      {
        id: "height",
        header: "Height",
        cell: ({ row }) => (
          <span className="text-center block">{row.original.heightCm} cm</span>
        ),
      },
      {
        id: "bmi",
        header: "BMI",
        cell: ({ row }) => {
          const { bmi } = computeBmi(
            row.original.weightKg,
            row.original.heightCm,
            age,
            sex,
          );
          return <span className="text-center block">{bmi}</span>;
        },
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const { category, color } = computeBmi(
            row.original.weightKg,
            row.original.heightCm,
            age,
            sex,
          );
          return (
            <span className="flex items-center justify-center gap-1.5 mx-auto">
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor:
                    color === "green"
                      ? "#22c55e"
                      : color === "orange"
                        ? "#f97316"
                        : "#ef4444",
                }}
              />
              {category}
            </span>
          );
        },
      },
      {
        id: "hfa",
        header: "HFA",
        cell: ({ row }) => {
          const { category } = computeHfa(row.original.heightCm, age, sex);
          return <span className="text-center block">{category}</span>;
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => (
          <div className="text-right">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedRecord(row.original);
                setIsAddDialogOpen(true);
              }}>
              Edit
            </Button>
          </div>
        ),
      },
    ],
    [age, sex],
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">
            Nutritional Status Assessment (SF8)
          </h2>
          <p className="text-sm text-muted-foreground">
            Monitor student BMI and Height-for-Age (HFA) records for BoSY and
            EoSY.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              void handleRefresh();
            }}
            disabled={isRefreshing}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          <Button
            onClick={() => {
              setSelectedRecord(null);
              setIsAddDialogOpen(true);
            }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Record
          </Button>
        </div>
      </div>

      {latestRecord ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                Latest Weight & Height
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {latestRecord.weightKg} kg / {latestRecord.heightCm} cm
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Recorded on{" "}
                {format(new Date(latestRecord.assessmentDate), "MMM d, yyyy")}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                BMI Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const { bmi, category, color } = computeBmi(
                  latestRecord.weightKg,
                  latestRecord.heightCm,
                  age,
                  sex,
                );
                return (
                  <>
                    <div className="text-2xl font-bold">{bmi} kg/m²</div>
                    <Badge
                      className="mt-1"
                      style={{
                        backgroundColor:
                          color === "green"
                            ? "#dcfce7"
                            : color === "orange"
                              ? "#ffedd5"
                              : "#fee2e2",
                        color:
                          color === "green"
                            ? "#166534"
                            : color === "orange"
                              ? "#9a3412"
                              : "#991b1b",
                        border: `1px solid ${color === "green" ? "#bbf7d0" : color === "orange" ? "#fed7aa" : "#fecaca"}`,
                      }}>
                      {category}
                    </Badge>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Ruler className="h-4 w-4 text-primary" />
                Height-for-Age (HFA)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const { category } = computeHfa(
                  latestRecord.heightCm,
                  age,
                  sex,
                );
                return (
                  <>
                    <div className="text-2xl font-bold">{category}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Nutritional classification based on WHO 2007
                    </p>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <Info className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">
              No health records found for this student.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setIsAddDialogOpen(true)}>
              Add First Record
            </Button>
          </CardContent>
        </Card>
      )}

      {sortedRecords.length > 0 && (
        <DataTable
          columns={columns}
          data={sortedRecords}
          noResultsMessage="No health records found."
        />
      )}

      <AddHealthRecord
        isOpen={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        applicantId={applicant.id}
        onSuccess={() => {
          setIsAddDialogOpen(false);
          onRefresh();
        }}
        editRecord={selectedRecord}
      />
    </div>
  );
}
