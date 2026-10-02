import { useEffect, useState, useCallback } from "react"
import { format, differenceInYears } from "date-fns"
import {
  User,
  GraduationCap,
  MapPin,
  Users,
  Calendar,
  X,
} from "lucide-react"
import api from "@/shared/api/axiosInstance"
import { toastApiError } from "@/shared/hooks/useApiToast"
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading"
import { Skeleton } from "@/shared/ui/skeleton"
import { Button } from "@/shared/ui/button"
import { Badge } from "@/shared/ui/badge"
import { SheetTitle, SheetDescription } from "@/shared/ui/sheet"
import { UserPhoto } from "@/shared/components/UserPhoto"
import { cn } from "@/shared/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

interface EarlyRegAddress {
  id: number
  addressType: string
  houseNoStreet: string | null
  street: string | null
  sitio: string | null
  barangay: string | null
  cityMunicipality: string | null
  province: string | null
  region: string | null
  country: string | null
  zipCode: string | null
}

interface EarlyRegFamilyMember {
  id: number
  relationship: string
  firstName: string
  lastName: string
  middleName: string | null
  extensionName: string | null
  contactNumber: string | null
  email: string | null
  maidenName: string | null
}

interface EarlyRegPreviousSchool {
  schoolName: string | null
  schoolId: string | null
  schoolAddress: string | null
  schoolType: string | null
  lastGradeCompleted: string | null
  schoolYearLastAttended: string | null
  generalAverage: number | null
}

interface EarlyRegLearner {
  id: number
  lrn: string | null
  firstName: string
  lastName: string
  middleName: string | null
  extensionName: string | null
  birthdate: string
  sex: string
  placeOfBirth: string | null
  religion: string | null
  motherTongue: string | null
  isIpCommunity: boolean
  ipGroupName: string | null
  isLearnerWithDisability: boolean
  disabilityTypes: string[]
  is4PsBeneficiary: boolean
  householdId4Ps: string | null
  isBalikAral: boolean
  lastYearEnrolled: string | null
  studentPhoto: string | null
}

interface EarlyRegGradeLevel {
  id: number
  name: string
}

interface EarlyRegistrationDetail {
  id: number
  status: string
  applicantType: string
  learnerType: string
  trackingNumber: string | null
  createdAt: string
  contactNumber: string | null
  learner: EarlyRegLearner
  gradeLevel: EarlyRegGradeLevel
  previousSchool: EarlyRegPreviousSchool | null
  addresses: EarlyRegAddress[]
  familyMembers: EarlyRegFamilyMember[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isValid = (value: unknown) => {
  if (value === null || value === undefined || value === "") return false
  const s = String(value).toUpperCase()
  return s !== "N/A" && s !== "NONE" && s !== "NULL"
}

function DataSection({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="border rounded-md mb-4 bg-[hsl(var(--card))] overflow-hidden">
      <div className="p-3 font-extrabold text-base leading-tight bg-[hsl(var(--muted)/50)] border-b flex items-center gap-2">
        {icon && <span className="text-primary">{icon}</span>}
        <span className="uppercase">{title}</span>
      </div>
      <div className="text-base leading-tight font-bold divide-y divide-border border-b-0">
        {children}
      </div>
    </div>
  )
}

function DataItem({
  label,
  value,
  mutedIfInvalid = false,
}: {
  label: string
  value: unknown
  mutedIfInvalid?: boolean
}) {
  const valid = isValid(value)
  if (!valid && !mutedIfInvalid) return null

  return (
    <div className="grid grid-cols-[180px_1fr] divide-x divide-border">
      <div className="p-3 text-foreground bg-muted/30 font-extrabold">
        {label}:
      </div>
      <div
        className={cn(
          "p-3 flex items-center",
          !valid ? "text-gray-300 font-bold" : "uppercase",
        )}>
        {valid ? String(value) : "—"}
      </div>
    </div>
  )
}

const formatDate = (dateString: string) => {
  try {
    return format(new Date(dateString), "MMMM d, yyyy")
  } catch {
    return "N/A"
  }
}

const getProgramLabel = (type: string | undefined | null) => {
  if (!type || type === "REGULAR") return "Basic Education Curriculum (BEC)"
  switch (type) {
    case "SCIENCE_TECHNOLOGY_AND_ENGINEERING":
      return "STE"
    case "SPECIAL_PROGRAM_IN_THE_ARTS":
      return "SPA"
    case "SPECIAL_PROGRAM_IN_SPORTS":
      return "SPS"
    default:
      return type
  }
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  id: number | null
  onClose: () => void
  onRefreshData?: () => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EarlyRegistrationReviewPanel({ id, onClose }: Props) {
  const [application, setApplication] = useState<EarlyRegistrationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const showSkeleton = useDelayedLoading(loading)

  const fetchDetail = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get<EarlyRegistrationDetail>(
        `/applications/early-registration-masterlist/${id}`,
      )
      setApplication(data)
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response: { data?: { message?: string } } }).response
              .data?.message
          : "Failed to load application details"
      setError(message || "An unexpected error occurred.")
      toastApiError(err as never)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) {
      void fetchDetail()
    }
  }, [id, fetchDetail])

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (showSkeleton) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-background">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b shrink-0">
          <div>
            <SheetTitle className="text-base sm:text-lg font-bold uppercase">
              <Skeleton className="h-6 w-40" />
            </SheetTitle>
            <SheetDescription
              asChild
              className="text-sm sm:text-base text-foreground mt-1">
              <div>
                <Skeleton className="h-3 w-24" />
              </div>
            </SheetDescription>
          </div>
        </div>
        <div className="flex-1 p-3 sm:p-6 space-y-4 overflow-y-auto">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-[200px] w-full mt-8" />
          <Skeleton className="h-[100px] w-full mt-4" />
        </div>
      </div>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────────

  if (error || !application) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-background">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b shrink-0">
          <SheetTitle className="text-base sm:text-lg font-bold uppercase">
            Error
          </SheetTitle>
        </div>
        <div className="h-full flex flex-col p-4 sm:p-6 items-center justify-center text-center">
          <p className="text-destructive mb-4">
            {error || "Application not found"}
          </p>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    )
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const learner = application.learner
  const fullName = `${learner.lastName}, ${learner.firstName}${learner.middleName ? ` ${learner.middleName.charAt(0)}.` : ""}${learner.extensionName ? ` ${learner.extensionName}` : ""}`

  const age = learner.birthdate
    ? differenceInYears(new Date(), new Date(learner.birthdate))
    : null

  const currentAddress = application.addresses.find(
    (a) => a.addressType === "CURRENT",
  )
  const permanentAddress = application.addresses.find(
    (a) => a.addressType === "PERMANENT",
  )

  const mother = application.familyMembers.find(
    (f) => f.relationship === "MOTHER",
  )
  const father = application.familyMembers.find(
    (f) => f.relationship === "FATHER",
  )
  const guardian = application.familyMembers.find(
    (f) => f.relationship === "GUARDIAN",
  )

  const renderContact = (
    label: string,
    member: EarlyRegFamilyMember | undefined,
  ) => {
    const memberName = member
      ? `${member.firstName} ${member.middleName || ""} ${member.maidenName || member.lastName}`
          .replace(/\s+/g, " ")
          .trim()
      : null

    return (
      <div className="grid grid-cols-[180px_1fr] divide-x divide-border">
        <div className="p-3 text-foreground bg-muted/30 flex items-center gap-1.5 flex-wrap font-extrabold">
          {label}:
        </div>
        <div className="p-3 flex flex-col justify-center">
          {memberName ? (
            <>
              <span className="uppercase">{memberName}</span>
              {(member?.contactNumber || member?.email) && (
                <span className="text-base font-bold text-foreground">
                  {[member.contactNumber, member.email]
                    .filter(isValid)
                    .join(" | ")}
                </span>
              )}
            </>
          ) : (
            <span className="text-gray-300 font-bold">—</span>
          )}
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b shrink-0 bg-primary font-bold">
        <div>
          <SheetTitle className="text-base sm:text-lg text-primary-foreground font-bold uppercase flex items-center gap-2">
            Early Registration Review
          </SheetTitle>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-primary-foreground hover:bg-primary-foreground/20 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-foreground focus:ring-offset-2 disabled:pointer-events-none">
            <X strokeWidth={3} className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 font-bold">
        {/* Summary Block */}
        <div className="bg-[hsl(var(--muted))] p-4 sm:p-6 rounded-md border">
          {/* Top Row: Identity */}
          <div className="flex justify-between items-start">
            {/* Left Side: Media Object */}
            <div className="flex items-start gap-4 sm:gap-6">
              <UserPhoto
                photo={learner.studentPhoto}
                containerClassName="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-primary border-dashed shadow-md shrink-0"
                className="w-full h-full object-cover rounded-full"
                alt={fullName}
                fallbackIcon={
                  <div className="w-full h-full rounded-full flex items-center justify-center text-white font-bold text-xl sm:text-2xl bg-primary">
                    {((f: string, l: string) => `${f}${l}`)(
                      String(learner.firstName || "")
                        .trim()
                        .charAt(0)
                        .toUpperCase(),
                      String(learner.lastName || "")
                        .trim()
                        .charAt(0)
                        .toUpperCase(),
                    ) || "?"}
                  </div>
                }
              />
              <div className="flex flex-col mt-1">
                <h3 className="text-2xl font-extrabold text-foreground leading-tight uppercase break-words">
                  {fullName}
                </h3>
                <p className="font-bold uppercase mb-2 text-lg">
                  LRN: {learner.lrn || "N/A"}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-amber-100 text-amber-800 border border-amber-200 px-3 py-0.5 rounded-full uppercase shadow-sm text-sm font-bold">
                    Early Registration
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Key Review Highlights Grid */}
          <div className="mt-6 mb-4">
            <div className="border rounded-md bg-[hsl(var(--card))] overflow-hidden">
              <div className="text-base leading-tight font-bold divide-y divide-border">
                {/* Header Row */}
                <div className="grid grid-cols-2 divide-x divide-border">
                  <div className="p-3 text-foreground bg-muted/30 font-extrabold text-center uppercase">
                    Target Grade Level
                  </div>
                  <div className="p-3 text-foreground bg-muted/30 font-extrabold text-center uppercase">
                    Date Submitted
                  </div>
                </div>
                {/* Value Row */}
                <div className="grid grid-cols-2 divide-x divide-border">
                  <div className="p-3 flex items-center justify-center uppercase min-w-0">
                    <span className="text-base font-bold text-foreground text-center">
                      {application.gradeLevel.name}
                    </span>
                  </div>

                  <div className="p-3 flex items-center justify-center uppercase min-w-0">
                    <span className="text-base font-bold text-foreground text-center tabular-nums">
                      {formatDate(application.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Academic History */}
        <DataSection
          title="Academic History"
          icon={<GraduationCap className="h-4 w-4" />}>
          <DataItem
            label="School Name"
            value={application.previousSchool?.schoolName}
            mutedIfInvalid
          />
          <DataItem
            label="School ID"
            value={application.previousSchool?.schoolId}
          />
          <DataItem
            label="Grade Completed"
            value={application.previousSchool?.lastGradeCompleted}
            mutedIfInvalid
          />
          <DataItem
            label="Year Attended"
            value={application.previousSchool?.schoolYearLastAttended}
          />
          <DataItem
            label="School Address"
            value={application.previousSchool?.schoolAddress}
          />
          <DataItem
            label="School Type"
            value={application.previousSchool?.schoolType}
          />
          <DataItem
            label="General Average"
            value={
              application.previousSchool?.generalAverage
                ? Number(application.previousSchool.generalAverage).toFixed(2)
                : null
            }
          />
        </DataSection>

        {/* Learner Demographics */}
        <DataSection
          title="Learner Demographics"
          icon={<User className="h-4 w-4" />}>
          <DataItem
            label="Date of Birth"
            value={learner.birthdate ? formatDate(learner.birthdate) : null}
            mutedIfInvalid
          />
          <DataItem label="Age" value={age} mutedIfInvalid />
          <DataItem
            label="Sex at Birth"
            value={learner.sex?.toUpperCase()}
            mutedIfInvalid
          />
          <DataItem label="Place of Birth" value={learner.placeOfBirth} />
          <DataItem label="Religion" value={learner.religion} />
          <DataItem label="Mother Tongue" value={learner.motherTongue} />
          <div className="grid grid-cols-[180px_1fr] divide-x divide-border">
            <div className="p-3 text-foreground bg-muted/30 flex items-center font-extrabold">
              IP Community:
            </div>
            <div className="p-3 flex items-center">
              {learner.isIpCommunity ? (
                <div className="text-foreground">
                  ({learner.ipGroupName || "No Group"})
                </div>
              ) : (
                <span className="text-foreground uppercase">No</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-[180px_1fr] divide-x divide-border">
            <div className="p-3 text-foreground bg-muted/30 flex items-center font-extrabold">
              4Ps Beneficiary:
            </div>
            <div className="p-3 flex items-center">
              {learner.is4PsBeneficiary ? (
                <div className="text-foreground">
                  ({learner.householdId4Ps || "No ID"})
                </div>
              ) : (
                <span className="text-foreground uppercase">No</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-[180px_1fr] divide-x divide-border">
            <div className="p-3 text-foreground bg-muted/30 flex items-center font-extrabold">
              Disability:
            </div>
            <div className="p-3 flex items-center">
              {learner.isLearnerWithDisability ? (
                <div className="space-y-2">
                  <div className="text-foreground">Has Disability</div>
                  {learner.disabilityTypes?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {learner.disabilityTypes.map((t) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="border-rose-200 text-rose-700 h-5 px-1.5 text-base">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-foreground uppercase">None</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-[180px_1fr] divide-x divide-border">
            <div className="p-3 text-foreground bg-muted/30 flex items-center font-extrabold">
              Balik-Aral:
            </div>
            <div className="p-3 flex items-center">
              {learner.isBalikAral ? (
                <div className="text-foreground">
                  ✓ Returning (Last: {learner.lastYearEnrolled})
                </div>
              ) : (
                <span className="text-foreground uppercase">No</span>
              )}
            </div>
          </div>
        </DataSection>

        {/* Contact & Address Information */}
        <DataSection
          title="Contact & Address"
          icon={<MapPin className="h-4 w-4" />}>
          <DataItem
            label="Contact Number"
            value={application.contactNumber}
            mutedIfInvalid
          />
          {currentAddress && (
            <>
              <DataItem
                label="House No/Street"
                value={currentAddress.houseNoStreet}
              />
              <DataItem label="Sitio/Purok" value={currentAddress.sitio} />
              <DataItem label="Barangay" value={currentAddress.barangay} />
              <DataItem
                label="City/Municipality"
                value={currentAddress.cityMunicipality}
              />
              <DataItem label="Province" value={currentAddress.province} />
              <DataItem label="Region" value={currentAddress.region} />
            </>
          )}
          {permanentAddress && (
            <>
              <div className="grid grid-cols-[180px_1fr] divide-x divide-border">
                <div className="p-3 text-foreground bg-muted/30 font-extrabold col-span-2 text-center uppercase text-sm">
                  Permanent Address
                </div>
              </div>
              <DataItem
                label="House No/Street"
                value={permanentAddress.houseNoStreet}
              />
              <DataItem label="Barangay" value={permanentAddress.barangay} />
              <DataItem
                label="City/Municipality"
                value={permanentAddress.cityMunicipality}
              />
              <DataItem label="Province" value={permanentAddress.province} />
            </>
          )}
        </DataSection>

        {/* Parents & Guardian */}
        <DataSection
          title="Parents & Guardian"
          icon={<Users className="h-4 w-4" />}>
          {renderContact("Mother", mother)}
          {renderContact("Father", father)}
          {renderContact("Guardian", guardian)}
        </DataSection>

        {/* Application Info */}
        <DataSection
          title="Application Information"
          icon={<Calendar className="h-4 w-4" />}>

          <DataItem
            label="Learner Type"
            value={application.learnerType?.replace(/_/g, " ")}
            mutedIfInvalid
          />
          <DataItem
            label="Submitted At"
            value={formatDate(application.createdAt)}
            mutedIfInvalid
          />
        </DataSection>
      </div>
    </div>
  )
}
