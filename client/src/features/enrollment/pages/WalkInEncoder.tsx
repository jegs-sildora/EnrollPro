import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Calendar as CalendarIcon, AlertTriangle, Search, Loader2, Mars, Venus, User } from "lucide-react";
import { isAxiosError } from "axios";
import { format, isValid, parse, isAfter, isBefore } from "date-fns";
import { sileo } from "sileo";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from "@/store/settings.slice";
import { PhilippineAddressSelector } from "@/shared/components/PhilippineAddressSelector";

type LearnerType = "NEW_ENROLLEE" | "TRANSFEREE" | "RETURNING" | "ALS";
type AcademicStatus = "PROMOTED" | "RETAINED" | "CONDITIONALLY_PROMOTED";
type Sex = "MALE" | "FEMALE";

interface GradeLevelOption {
  id: number;
  name: string;
}

interface ContactPersonState {
  firstName: string;
  lastName: string;
  middleName: string;
  extensionName: string;
  contactNumber: string;
}

interface WalkInFormState {
  hasNoLrn: boolean;
  lrn: string;
  learnerType: LearnerType;
  gradeLevelId: string;
  academicStatus: AcademicStatus;
  firstName: string;
  lastName: string;
  middleName: string;
  extensionName: string;
  birthdate: string;
  sex: Sex | "";
  placeOfBirth: string;
  currentAddressHouseNoStreet: string;
  currentAddressSitio: string;
  currentAddressBarangay: string;
  currentAddressCityMunicipality: string;
  currentAddressRegion: string;
  currentAddressProvince: string;
  mother: ContactPersonState;
  father: ContactPersonState;
  guardian: ContactPersonState;
  guardianRelationship: string;
  contactNumber: string;
  primaryContact: "MOTHER" | "FATHER" | "GUARDIAN" | "";
  hasNoMother: boolean;
  hasNoFather: boolean;
  email: string;
  originSchoolName: string;
  lastSchoolId: string;
  schoolYearLastAttended: string;
  lastGradeCompleted: string;
  lastSchoolType: string;
  lastSchoolAddress: string;
  peptCertificateNumber: string;
  peptPassingDate: string;
  finalGeneralAverage: string;
  isSf9Submitted: boolean;
  isPsaBirthCertPresented: boolean;
}

interface HydrationContextState {
  source: "ENROLLMENT" | "EARLY_REGISTRATION";
  status: string;
  enrollmentApplicationId: number | null;
  earlyRegistrationId: number | null;
  applicantType: string | null;
}

interface LateSectionOption {
  id: number;
  name: string;
  enrolledCount: number;
  maxCapacity: number;
}

const EMPTY_CONTACT: ContactPersonState = {
  firstName: "",
  lastName: "",
  middleName: "",
  extensionName: "",
  contactNumber: "",
};

const INITIAL_FORM_STATE: WalkInFormState = {
  hasNoLrn: false,
  lrn: "",
  learnerType: "TRANSFEREE",
  gradeLevelId: "",
  academicStatus: "PROMOTED",
  firstName: "",
  lastName: "",
  middleName: "",
  extensionName: "",
  birthdate: "",
  sex: "",
  placeOfBirth: "",
  currentAddressHouseNoStreet: "",
  currentAddressSitio: "",
  currentAddressBarangay: "",
  currentAddressCityMunicipality: "HINIGARAN",
  currentAddressRegion: "NEGROS ISLAND REGION (NIR)",
  currentAddressProvince: "NEGROS OCCIDENTAL",
  mother: { ...EMPTY_CONTACT },
  father: { ...EMPTY_CONTACT },
  guardian: { ...EMPTY_CONTACT },
  guardianRelationship: "",
  contactNumber: "",
  primaryContact: "",
  hasNoMother: false,
  hasNoFather: false,
  email: "",
  originSchoolName: "",
  lastSchoolId: "",
  schoolYearLastAttended: "",
  lastGradeCompleted: "",
  lastSchoolType: "PUBLIC",
  lastSchoolAddress: "",
  peptCertificateNumber: "",
  peptPassingDate: "",
  finalGeneralAverage: "",
  isSf9Submitted: false,
  isPsaBirthCertPresented: false,
};

const APPLICANT_TYPE_LABELS: Record<string, string> = {
  REGULAR: "Regular Basic Education",
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: "Science, Technology & Engineering (STE)",
  SPECIAL_PROGRAM_IN_THE_ARTS: "Special Program in the Arts",
  SPECIAL_PROGRAM_IN_SPORTS: "Special Program in Sports",
  SPECIAL_PROGRAM_IN_JOURNALISM: "Special Program in Journalism",
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: "Special Program in Foreign Language",
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION:
    "Special Program in Technical-Vocational Education",
};

function normalizeLrn(value: string): string {
  return value.replace(/[^\d]/g, "").slice(0, 12);
}

function normalizeSchoolId(value: string): string {
  return value.replace(/[^\d]/g, "").slice(0, 6);
}

function normalizeContactNumber(value: string): string {
  return value.replace(/[^\d]/g, "").slice(0, 11);
}

function toOptionalTrimmed(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function hasContactIdentity(person: ContactPersonState): boolean {
  return Boolean(person.firstName.trim() && person.lastName.trim());
}

export default function WalkInEncoder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeSchoolYearLabel, selectedAccentHsl, colorScheme } = useSettingsStore();
  const accentHsl = selectedAccentHsl ?? (colorScheme as { accent_hsl?: string } | null)?.accent_hsl;

  const initialLrn = useMemo(
    () => normalizeLrn(searchParams.get("lrn") ?? ""),
    [searchParams],
  );

  const [formData, setFormData] = useState<WalkInFormState>(() => ({
    ...INITIAL_FORM_STATE,
    lrn: initialLrn,
  }));
  const [gradeLevels, setGradeLevels] = useState<GradeLevelOption[]>([]);
  const [loadingGradeLevels, setLoadingGradeLevels] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hydrationContext, setHydrationContext] =
    useState<HydrationContextState | null>(null);
  const [hydratedGradeToken, setHydratedGradeToken] = useState<string | null>(
    null,
  );

  // --- Front-Door Interceptor state ---
  const [interceptorLrn, setInterceptorLrn] = useState(initialLrn);
  const [isFormUnlocked, setIsFormUnlocked] = useState(false);
  const [isSearchingLrn, setIsSearchingLrn] = useState(false);
  const [showNoLrnBanner, setShowNoLrnBanner] = useState(false);
  // isUnderGuardianCare derived from primaryContact
  const isUnderGuardianCare = formData.primaryContact === "GUARDIAN";

  // --- Post-Submission Modal Section Assignment state ---
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [createdAppId, setCreatedAppId] = useState<number | null>(null);
  const [createdGradeLevelName, setCreatedGradeLevelName] = useState<string>("");
  const [modalSections, setModalSections] = useState<LateSectionOption[]>([]);
  const [loadingModalSections, setLoadingModalSections] = useState(false);
  const [selectedModalSectionId, setSelectedModalSectionId] = useState<number | null>(null);

  const [lateEnrollmentDate, setLateEnrollmentDate] = useState(
    () => format(new Date(), "yyyy-MM-dd"),
  );
  const [isCapacityOverrideOpen, setIsCapacityOverrideOpen] = useState(false);
  const [pendingOverrideContext, setPendingOverrideContext] = useState<{
    enrollmentApplicationId: number;
    sectionId: number;
    date: string;
  } | null>(null);

  const [dateInput, setDateInput] = useState(() => {
    if (!formData.birthdate) return "";
    const d = new Date(formData.birthdate);
    return isValid(d) ? format(d, "MM/dd/yyyy") : "";
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    if (formData.birthdate) {
      const d = new Date(formData.birthdate);
      if (isValid(d)) return d;
    }
    return new Date();
  });

  const handleDateTyping = (value: string, onChange: (val: string) => void) => {
    const isDeleting = value.length < dateInput.length;
    const cleaned = value.replace(/\D/g, "").slice(0, 8);

    let masked = "";
    if (cleaned.length > 0) {
      masked = cleaned.slice(0, 2);
      if (cleaned.length > 2 || (cleaned.length === 2 && !isDeleting)) {
        masked += "/";
      }
      if (cleaned.length > 2) {
        masked += cleaned.slice(2, 4);
        if (cleaned.length > 4 || (cleaned.length === 4 && !isDeleting)) {
          masked += "/";
        }
      }
      if (cleaned.length > 4) {
        masked += cleaned.slice(4, 8);
      }
    }

    setDateInput(masked);

    if (masked.length === 10) {
      const parsedDate = parse(masked, "MM/dd/yyyy", new Date());
      if (
        isValid(parsedDate) &&
        !isAfter(parsedDate, new Date()) &&
        !isBefore(parsedDate, new Date(1900, 0, 1))
      ) {
        onChange(format(parsedDate, "yyyy-MM-dd"));
        setCalendarMonth(parsedDate);
      } else {
        onChange("");
      }
    } else {
      onChange("");
    }
  };

  useEffect(() => {
    void fetchGradeLevels();
  }, []);

  // Handle LRN from query params on mount
  useEffect(() => {
    if (initialLrn && initialLrn.length === 12) {
      setInterceptorLrn(initialLrn);
      void handleInterceptorSearch(initialLrn);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLrn]);

  const handleInterceptorSearch = async (forcedLrn?: string) => {
    const targetLrn = (forcedLrn || interceptorLrn).replace(/[^\d]/g, "");
    if (targetLrn.length !== 12) {
      sileo.error({
        title: "Invalid LRN",
        description: "Please enter a valid 12-digit Learner Reference Number.",
      });
      return;
    }

    setIsSearchingLrn(true);
    setShowNoLrnBanner(false);
    try {
      const response = await api.get(`/applications/lookup-lrn/${targetLrn}`);
      const payload = response.data as Record<string, unknown>;

      const normalizedBirthdate = payload.birthdate
        ? new Date(String(payload.birthdate)).toISOString().slice(0, 10)
        : "";

      setFormData((prev) => {
        const motherPayload = (payload.mother as Partial<ContactPersonState> | undefined) ?? EMPTY_CONTACT;
        const fatherPayload = (payload.father as Partial<ContactPersonState> | undefined) ?? EMPTY_CONTACT;
        const guardianPayload = (payload.guardian as Partial<ContactPersonState> | undefined) ?? EMPTY_CONTACT;
        const currentAddressPayload = (payload.currentAddress as {
          houseNo?: string; street?: string; region?: string; barangay?: string;
          cityMunicipality?: string; province?: string;
        } | undefined) ?? undefined;

        return {
          ...prev,
          lrn: targetLrn,
          firstName: String(payload.firstName ?? ""),
          lastName: String(payload.lastName ?? ""),
          middleName: String(payload.middleName ?? ""),
          extensionName: String(payload.extensionName ?? ""),
          birthdate: normalizedBirthdate,
          sex: (String(payload.sex || "").toUpperCase()) as Sex | "",
          placeOfBirth: String(payload.placeOfBirth ?? ""),
          contactNumber: String(payload.contactNumber ?? ""),
          email: String(payload.email ?? ""),
          originSchoolName: String(payload.lastSchoolName ?? payload.originSchoolName ?? ""),
          lastSchoolId: String(payload.lastSchoolId ?? ""),
          schoolYearLastAttended: String(payload.schoolYearLastAttended ?? ""),
          lastGradeCompleted: String(payload.lastGradeCompleted ?? ""),
          lastSchoolAddress: String(payload.lastSchoolAddress ?? ""),
          guardianRelationship: String(payload.guardianRelationship ?? ""),
          primaryContact: "",
          hasNoMother: !motherPayload.firstName,
          hasNoFather: !fatherPayload.firstName,
          learnerType: (payload.learnerType || "TRANSFEREE") as LearnerType,
          gradeLevelId: payload.gradeLevelId ? String(payload.gradeLevelId) : "",
          academicStatus: (payload.academicStatus || "PROMOTED") as AcademicStatus,
          mother: {
            firstName: String(motherPayload.firstName ?? ""),
            lastName: String(motherPayload.lastName ?? ""),
            middleName: String(motherPayload.middleName ?? ""),
            extensionName: String((motherPayload as any).extensionName ?? ""),
            contactNumber: String(motherPayload.contactNumber ?? ""),
          },
          father: {
            firstName: String(fatherPayload.firstName ?? ""),
            lastName: String(fatherPayload.lastName ?? ""),
            middleName: String(fatherPayload.middleName ?? ""),
            extensionName: String((fatherPayload as any).extensionName ?? ""),
            contactNumber: String(fatherPayload.contactNumber ?? ""),
          },
          guardian: {
            firstName: String(guardianPayload.firstName ?? ""),
            lastName: String(guardianPayload.lastName ?? ""),
            middleName: String(guardianPayload.middleName ?? ""),
            extensionName: String((guardianPayload as any).extensionName ?? ""),
            contactNumber: String(guardianPayload.contactNumber ?? ""),
          },
          currentAddressHouseNoStreet: String(currentAddressPayload?.houseNo ?? "") || prev.currentAddressHouseNoStreet,
          currentAddressBarangay: String(currentAddressPayload?.barangay ?? "") || prev.currentAddressBarangay,
          currentAddressCityMunicipality: String(currentAddressPayload?.cityMunicipality ?? "") || prev.currentAddressCityMunicipality,
          currentAddressRegion: String(currentAddressPayload?.region ?? "") || prev.currentAddressRegion,
          currentAddressProvince: String(currentAddressPayload?.province ?? "") || prev.currentAddressProvince,
          isSf9Submitted: !!payload.isSf9Submitted,
          isPsaBirthCertPresented: !!payload.isPsaBirthCertPresented,
          finalGeneralAverage: payload.finalGeneralAverage ? String(payload.finalGeneralAverage) : "",
        };
      });

      setDateInput(normalizedBirthdate ? format(new Date(normalizedBirthdate), "MM/dd/yyyy") : "");



      if (payload.gradeLevelId) {
        setHydratedGradeToken(String(payload.gradeLevelId));
      } else if (payload.gradeLevel) {
        setHydratedGradeToken(String(payload.gradeLevel));
      }

      setHydrationContext({
        source: String(payload.source) === "ENROLLMENT" ? "ENROLLMENT" : "EARLY_REGISTRATION",
        status: String(payload.status ?? ""),
        enrollmentApplicationId: typeof payload.enrollmentApplicationId === "number" ? payload.enrollmentApplicationId : null,
        earlyRegistrationId: typeof payload.earlyRegistrationId === "number" ? payload.earlyRegistrationId : null,
        applicantType: typeof payload.applicantType === "string" ? payload.applicantType : null,
      });

      setIsFormUnlocked(true);
      sileo.success({
        title: "Learner Profile Found",
        description: `Auto-populated data for ${String(payload.firstName ?? "")} ${String(payload.lastName ?? "")}.`,
      });
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        setFormData({
          ...INITIAL_FORM_STATE,
          lrn: targetLrn,
        });
        setHydrationContext(null);
        setHydratedGradeToken(null);
        setIsFormUnlocked(false);
        setShowNoLrnBanner(true);
      } else {
        toastApiError(error as never);
      }
    } finally {
      setIsSearchingLrn(false);
    }
  };

  useEffect(() => {
    if (
      !hydratedGradeToken ||
      gradeLevels.length === 0 ||
      formData.gradeLevelId
    ) {
      return;
    }

    const normalized = hydratedGradeToken.replace(/[^\d]/g, "");
    const matched = gradeLevels.find((level) => {
      const levelToken = String(level.name).replace(/[^\d]/g, "");
      return levelToken === normalized;
    });

    if (matched) {
      setField("gradeLevelId", String(matched.id));
    }
  }, [formData.gradeLevelId, gradeLevels, hydratedGradeToken]);

  const fetchGradeLevels = async () => {
    setLoadingGradeLevels(true);
    try {
      const response = await api.get("/school-years/grade-levels");
      setGradeLevels(response.data.gradeLevels || response.data || []);
    } catch (error) {
      toastApiError(error as never);
    } finally {
      setLoadingGradeLevels(false);
    }
  };

  const selectedGradeLevel = useMemo(
    () =>
      gradeLevels.find(
        (gradeLevel) => String(gradeLevel.id) === formData.gradeLevelId,
      ) ?? null,
    [formData.gradeLevelId, gradeLevels],
  );

  const setField = <T extends keyof WalkInFormState>(
    key: T,
    value: WalkInFormState[T],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const setUpperField = <T extends keyof WalkInFormState>(
    key: T,
    value: string,
  ) => {
    setField(key, value.toUpperCase() as WalkInFormState[T]);
  };

  const setContactField = (
    bucket: "mother" | "father" | "guardian",
    key: keyof ContactPersonState,
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [bucket]: {
        ...prev[bucket],
        [key]: key === "contactNumber" ? value : value.toUpperCase(),
      },
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.lastName.trim() || !formData.firstName.trim()) {
      sileo.error({
        title: "Missing Learner Name",
        description: "Last name and first name are required.",
      });
      return false;
    }

    if (!formData.birthdate || !formData.sex || !formData.gradeLevelId) {
      sileo.error({
        title: "Missing Required Learner Details",
        description: "Birthdate, sex, and grade level are required.",
      });
      return false;
    }

    if (
      !formData.currentAddressBarangay.trim() ||
      !formData.currentAddressCityMunicipality.trim() ||
      !formData.currentAddressRegion.trim() ||
      !formData.currentAddressProvince.trim()
    ) {
      sileo.error({
        title: "Missing Address Fields",
        description: "Barangay, city/municipality, and province are required.",
      });
      return false;
    }

    if (!/^\d{12}$/.test(formData.lrn.trim())) {
      sileo.error({
        title: "Invalid LRN",
        description: "LRN must be exactly 12 digits.",
      });
      return false;
    }

    if (
      formData.learnerType === "TRANSFEREE" &&
      !formData.originSchoolName.trim()
    ) {
      sileo.error({
        title: "Origin School Required",
        description: "Provide origin school name for transferees.",
      });
      return false;
    }

    if (
      formData.lastSchoolId.trim() &&
      !/^\d{6}$/.test(formData.lastSchoolId.trim())
    ) {
      sileo.error({
        title: "Invalid School ID",
        description: "DepEd School ID must be exactly 6 digits.",
      });
      return false;
    }

    // Validate Mother's Maiden Name (First Name & Maiden Last Name)
    if (!formData.mother.firstName.trim() || !formData.mother.lastName.trim()) {
      sileo.error({
        title: "Missing Mother's Name",
        description: "Mother's first name and maiden last name are required.",
      });
      return false;
    }

    // Validate Primary Contact Number (Mandatory, 11 digits)
    if (!formData.contactNumber.trim() || !/^\d{11}$/.test(formData.contactNumber.trim())) {
      sileo.error({
        title: "Invalid Contact Number",
        description: "Primary contact number is required and must be exactly 11 digits.",
      });
      return false;
    }

    // Validate Guardian details if toggled on
    if (isUnderGuardianCare) {
      if (!formData.guardian.firstName.trim() || !formData.guardian.lastName.trim()) {
        sileo.error({
          title: "Missing Guardian's Name",
          description: "Guardian's first name and last name are required.",
        });
        return false;
      }
      if (!formData.guardianRelationship.trim()) {
        sileo.error({
          title: "Missing Relationship",
          description: "Guardian relationship to learner is required.",
        });
        return false;
      }
    }

    if (!formData.isSf9Submitted || !formData.isPsaBirthCertPresented) {
      sileo.error({
        title: "Physical Requirements Required",
        description:
          "Confirm both SF9 and PSA Birth Certificate before routing to sectioning.",
      });
      return false;
    }

    const finalAverage = Number.parseFloat(formData.finalGeneralAverage);
    if (Number.isNaN(finalAverage) || finalAverage < 0 || finalAverage > 100) {
      sileo.error({
        title: "Invalid General Average",
        description: "Provide a valid Final General Average between 0 and 100.",
      });
      return false;
    }

    return true;
  };

  const handleResetForm = () => {
    setFormData(INITIAL_FORM_STATE);
    setInterceptorLrn("");
    setIsFormUnlocked(false);
    setShowNoLrnBanner(false);
    setCreatedAppId(null);
    setSelectedModalSectionId(null);
    setModalSections([]);
    setHydrationContext(null);
    setHydratedGradeToken(null);
    setDateInput("");
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    const finalGeneralAverage =
      formData.finalGeneralAverage.trim().length > 0
        ? parseFloat(formData.finalGeneralAverage)
        : undefined;

    const payload = {
      lrn: formData.lrn.trim(),
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      middleName: toOptionalTrimmed(formData.middleName),
      extensionName: toOptionalTrimmed(formData.extensionName),
      birthdate: formData.birthdate,
      sex: formData.sex,
      placeOfBirth: toOptionalTrimmed(formData.placeOfBirth),
      learnerType: formData.learnerType,
      applicantType: "LATE_ENROLLEE",
      gradeLevelId: Number(formData.gradeLevelId),
      academicStatus: formData.academicStatus,
      lastSchoolName: toOptionalTrimmed(formData.originSchoolName),
      lastSchoolId: toOptionalTrimmed(formData.lastSchoolId),
      schoolYearLastAttended: toOptionalTrimmed(
        formData.schoolYearLastAttended,
      ),
      lastGradeCompleted: toOptionalTrimmed(formData.lastGradeCompleted),
      lastSchoolType: formData.lastSchoolType,
      lastSchoolAddress: toOptionalTrimmed(formData.lastSchoolAddress),
      originSchoolName: toOptionalTrimmed(formData.originSchoolName),
      peptCertificateNumber: toOptionalTrimmed(formData.peptCertificateNumber),
      peptPassingDate: formData.peptPassingDate || undefined,
      generalAverage: finalGeneralAverage,
      contactNumber: toOptionalTrimmed(formData.contactNumber),
      email: toOptionalTrimmed(formData.email),
      currentAddress: {
        houseNoStreet: toOptionalTrimmed(formData.currentAddressHouseNoStreet),
        sitio: toOptionalTrimmed(formData.currentAddressSitio),
        barangay: formData.currentAddressBarangay.trim(),
        cityMunicipality: formData.currentAddressCityMunicipality.trim(),
        region: formData.currentAddressRegion.trim(),
        province: formData.currentAddressProvince.trim(),
      },
      mother: formData.hasNoMother
        ? { firstName: "N/A", lastName: "N/A", middleName: undefined, extensionName: undefined, contactNumber: formData.primaryContact === "MOTHER" ? toOptionalTrimmed(formData.contactNumber) : undefined }
        : hasContactIdentity(formData.mother)
          ? {
              firstName: formData.mother.firstName.trim(),
              lastName: formData.mother.lastName.trim(),
              middleName: toOptionalTrimmed(formData.mother.middleName),
              extensionName: toOptionalTrimmed(formData.mother.extensionName),
              contactNumber: formData.primaryContact === "MOTHER" ? toOptionalTrimmed(formData.contactNumber) : undefined,
            }
          : undefined,
      father: formData.hasNoFather
        ? { firstName: "N/A", lastName: "N/A", middleName: undefined, extensionName: undefined, contactNumber: formData.primaryContact === "FATHER" ? toOptionalTrimmed(formData.contactNumber) : undefined }
        : hasContactIdentity(formData.father)
          ? {
              firstName: formData.father.firstName.trim(),
              lastName: formData.father.lastName.trim(),
              middleName: toOptionalTrimmed(formData.father.middleName),
              extensionName: toOptionalTrimmed(formData.father.extensionName),
              contactNumber: formData.primaryContact === "FATHER" ? toOptionalTrimmed(formData.contactNumber) : undefined,
            }
          : undefined,
      guardian: formData.primaryContact === "GUARDIAN" && hasContactIdentity(formData.guardian)
        ? {
            firstName: formData.guardian.firstName.trim(),
            lastName: formData.guardian.lastName.trim(),
            middleName: toOptionalTrimmed(formData.guardian.middleName),
            extensionName: toOptionalTrimmed(formData.guardian.extensionName),
            contactNumber: toOptionalTrimmed(formData.contactNumber),
          }
        : undefined,
      guardianRelationship: formData.primaryContact === "GUARDIAN" ? toOptionalTrimmed(formData.guardianRelationship) : undefined,
    };

    setSubmitting(true);
    try {
      const response = await api.post(
        "/applications/special-enrollment",
        payload,
      );

      const enrollmentApplicationId = response.data?.enrollmentApplicationId as number | undefined;
      if (!enrollmentApplicationId) {
        sileo.error({
          title: "Save Error",
          description: "BEEF saved but could not retrieve application ID for sectioning.",
        });
        setSubmitting(false);
        return;
      }

      setCreatedAppId(enrollmentApplicationId);

      const gradeName = selectedGradeLevel?.name || "Target Grade";
      setCreatedGradeLevelName(gradeName);

      // Fetch sections for this grade level
      setLoadingModalSections(true);
      try {
        const sectionsRes = await api.get("/sections", {
          params: { gradeLevelId: formData.gradeLevelId },
        });
        setModalSections(sectionsRes.data.sections || []);
      } catch (err) {
        console.error("Failed to load sections for modal", err);
      } finally {
        setLoadingModalSections(false);
      }

      // Open the modal
      setShowSectionModal(true);
    } catch (error) {
      toastApiError(error as never);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmSectionAssignment = async () => {
    if (!createdAppId || !selectedModalSectionId) return;

    setSubmitting(true);
    try {
      await api.post(`/sections/${selectedModalSectionId}/inline-slot`, {
        enrollmentApplicationId: createdAppId,
        officialEnrollmentDate: lateEnrollmentDate,
        isCapacityOverride: false,
      });

      const sectionName = modalSections.find(s => s.id === selectedModalSectionId)?.name || "Section";

      sileo.success({
        title: "Assignment Successful",
        description: `Learner successfully added to Section ${sectionName}`,
      });

      handleResetForm();
      setShowSectionModal(false);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      if (axiosErr?.response?.status === 409) {
        setPendingOverrideContext({
          enrollmentApplicationId: createdAppId,
          sectionId: selectedModalSectionId,
          date: lateEnrollmentDate
        });
        setIsCapacityOverrideOpen(true);
      } else {
        sileo.error({
          title: "Assignment Failed",
          description: axiosErr?.response?.data?.message ?? "Failed to assign learner to section.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipSectionAssignment = () => {
    sileo.success({
      title: "Learner Saved",
      description: "Learner successfully saved to the unassigned queue.",
    });
    handleResetForm();
    setShowSectionModal(false);
  };

  const doInlineSlotWithOverride = async (appId: number, secId: number, date: string) => {
    setSubmitting(true);
    try {
      await api.post(`/sections/${secId}/inline-slot`, {
        enrollmentApplicationId: appId,
        officialEnrollmentDate: date,
        isCapacityOverride: true,
      });

      const sectionName = modalSections.find(s => s.id === secId)?.name || "Section";

      sileo.success({
        title: "Assignment Successful",
        description: `Learner successfully added to Section ${sectionName} via capacity override`,
      });

      handleResetForm();
      setShowSectionModal(false);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      sileo.error({
        title: "Override Failed",
        description: axiosErr?.response?.data?.message ?? "Failed to assign learner to section.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const hydratedApplicantType = hydrationContext?.applicantType ?? null;
  const hydratedApplicantLabel = hydratedApplicantType
    ? (APPLICANT_TYPE_LABELS[hydratedApplicantType] ?? hydratedApplicantType)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 text-left">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold">
            Late Enrollment Form (BEEF)
          </h1>
          <p className="text-base leading-tight text-foreground font-bold">
            Enter paper forms for mid-year transfers and late entrants. A valid 12-digit LRN is required.
          </p>
        </div>
        <div className="text-base font-bold text-slate-800 whitespace-nowrap bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-300 sm:mt-1">
          Late Entry: S.Y. {activeSchoolYearLabel || "2026–2027"}
        </div>
      </div>

      {/* 2. THE LRN FRONT-DOOR INTERCEPTOR */}
      <Card className="border border-slate-200 bg-white shadow-sm rounded-xl mb-6">
        <CardContent className="p-5 md:p-6 flex flex-col space-y-4 text-left">
          <div className="space-y-2">
            <Label htmlFor="interceptorLrn" className="text-base font-bold text-slate-800">
              Learner Reference Number (LRN) *
            </Label>
            <div className="flex gap-3 w-full max-w-6.5xl items-start">
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  id="interceptorLrn"
                  value={interceptorLrn}
                  maxLength={12}
                  disabled={isSearchingLrn || isFormUnlocked}
                  placeholder="Type 12-digit LRN..."
                  className="pl-11 h-12 text-lg font-bold tracking-wider text-slate-800 rounded-xl"
                  onChange={(e) => {
                    setInterceptorLrn(e.target.value.replace(/[^\d]/g, "").slice(0, 12));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleInterceptorSearch();
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                disabled={isSearchingLrn || isFormUnlocked}
                onClick={() => { void handleInterceptorSearch(); }}
                className="h-12 w-32 font-bold uppercase tracking-wider text-white border-none shadow-none rounded-xl shrink-0"
                style={{ backgroundColor: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))" }}
              >
                {isSearchingLrn ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Search"
                )}
              </Button>
            </div>
            <p className="text-base font-bold">
              Checks local school records to prevent duplicate enrollment.
            </p>
          </div>

          {/* DYNAMIC FEEDBACK ZONE */}
          {showNoLrnBanner && !isFormUnlocked && (
            <div className="w-full max-w-6.5  xl p-4 rounded-xl border border-amber-200 bg-amber-50 text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-start sm:items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                <p className="text-base font-bold text-amber-900">
                  LRN not found in database. Encode as a brand new learner profile?
                </p>
              </div>
              <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="h-9 px-4 font-bold bg-white text-slate-700 border-amber-200 hover:bg-amber-100 flex-1 sm:flex-none"
                  onClick={() => {
                    setShowNoLrnBanner(false);
                    setInterceptorLrn("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="h-9 px-4 font-bold bg-amber-600 text-white hover:bg-amber-700 shadow-none border-none flex-1 sm:flex-none"
                  onClick={() => {
                    setShowNoLrnBanner(false);
                    setIsFormUnlocked(true);
                  }}
                >
                  Yes, Encode New
                </Button>
              </div>
            </div>
          )}
          {hydrationContext && isFormUnlocked && (
            <div className="w-full max-w-3xl p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-left flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 shrink-0">
                <span className="text-emerald-700 font-bold text-xs">✓</span>
              </div>
              <p className="text-base font-bold text-emerald-900">
                Verified LIS Profile: {formData.lastName}, {formData.firstName}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn("border border-slate-200 bg-white shadow-sm rounded-xl transition-all duration-300", !isFormUnlocked && "opacity-50")}>
        <CardContent className="p-8">
          <form onSubmit={(e) => { e.preventDefault(); }} className="space-y-10">
            <fieldset disabled={!isFormUnlocked} className="space-y-10">

              {/* 3. SECTION 1: LEARNER INFORMATION */}
              <section className="space-y-6 text-left">
                <h3
                  className="text-xl font-bold pl-3 border-l-4"
                  style={{
                    borderColor: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))",
                    color: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))"
                  }}
                >
                  1. Learner Information
                </h3>

                {hydrationContext && (
                  <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 mb-4">
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-[11px] font-black uppercase">
                      Record Found: {hydrationContext.source === "ENROLLMENT" ? "Pending Queue Record" : "Early Registrant"}
                    </Badge>
                    <p className="text-base font-bold uppercase text-emerald-800">
                      Status: {hydrationContext.status.replace(/_/g, " ")}
                    </p>
                    {hydratedApplicantLabel && hydratedApplicantType !== "REGULAR" && (
                      <p className="text-base leading-tight font-black text-emerald-955">
                        Curriculum: {hydratedApplicantLabel} {hydrationContext.status === "PENDING_BEEF" ? "- PASSER" : ""}
                      </p>
                    )}
                  </div>
                )}

                {/* Row 1 (Academic Assignment) */}
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label className="text-base font-bold text-slate-800">
                      Learner Reference Number (LRN) *
                    </Label>
                    <Input
                      value={formData.lrn}
                      disabled={true}
                      className="h-10 font-bold bg-slate-100 border-slate-200 text-slate-700 disabled:opacity-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-bold text-slate-800">
                      Learner Type *
                    </Label>
                    <Select
                      value={formData.learnerType}
                      onValueChange={(val) => setField("learnerType", val as LearnerType)}
                    >
                      <SelectTrigger className="h-10 font-bold bg-white">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NEW_ENROLLEE" className="font-bold">New Enrollee (Grade 7 Entry)</SelectItem>
                        <SelectItem value="TRANSFEREE" className="font-bold">Transferee (Move-In from Other School)</SelectItem>
                        <SelectItem value="RETURNING" className="font-bold">Returning Learner (Balik-Aral)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-bold text-slate-800">
                      Grade Level *
                    </Label>
                    <Select
                      value={formData.gradeLevelId}
                      onValueChange={(val) => setField("gradeLevelId", val)}
                      disabled={loadingGradeLevels}
                    >
                      <SelectTrigger className="h-10 font-bold bg-white">
                        <SelectValue placeholder={loadingGradeLevels ? "Loading grades..." : "Select grade"} />
                      </SelectTrigger>
                      <SelectContent>
                        {gradeLevels.map((g) => (
                          <SelectItem key={g.id} value={String(g.id)} className="font-bold">
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-bold text-slate-800">
                      Prior Academic Status *
                    </Label>
                    <Select
                      value={formData.academicStatus}
                      onValueChange={(val) => setField("academicStatus", val as AcademicStatus)}
                    >
                      <SelectTrigger className="h-10 font-bold bg-white">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PROMOTED" className="font-bold">Promoted</SelectItem>
                        <SelectItem value="CONDITIONALLY_PROMOTED" className="font-bold">Conditional (Irregular)</SelectItem>
                        <SelectItem value="RETAINED" className="font-bold">Retained (Held Back)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 2 (Legal Identity) */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-base font-bold text-slate-800">
                      Last Name *
                    </Label>
                    <Input
                      value={formData.lastName}
                      placeholder="LAST NAME"
                      className="h-10 font-bold uppercase bg-white"
                      onChange={(e) => setUpperField("lastName", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-bold text-slate-800">
                      First Name *
                    </Label>
                    <Input
                      value={formData.firstName}
                      placeholder="FIRST NAME"
                      className="h-10 font-bold uppercase bg-white"
                      onChange={(e) => setUpperField("firstName", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-bold text-slate-800">
                      Middle Name
                    </Label>
                    <Input
                      value={formData.middleName}
                      placeholder="Leave blank if none"
                      className="h-10 font-bold uppercase bg-white"
                      onChange={(e) => setUpperField("middleName", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-bold text-slate-800">
                      Extension Name
                    </Label>
                    <Select
                      value={formData.extensionName || "NONE"}
                      onValueChange={(val) => setField("extensionName", val === "NONE" ? "" : val)}
                    >
                      <SelectTrigger className="h-10 font-bold bg-white">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE" className="font-bold">None</SelectItem>
                        <SelectItem value="JR" className="font-bold">Jr.</SelectItem>
                        <SelectItem value="II" className="font-bold">II</SelectItem>
                        <SelectItem value="III" className="font-bold">III</SelectItem>
                        <SelectItem value="IV" className="font-bold">IV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 3 (Birthdate, Sex, Place of Birth) */}
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label className="text-base font-bold text-slate-800">
                      Birthdate *
                    </Label>
                    <div className="relative">
                      <Input
                        placeholder="MM/DD/YYYY"
                        maxLength={10}
                        inputMode="numeric"
                        value={dateInput}
                        onChange={(e) =>
                          handleDateTyping(e.target.value, (val) =>
                            setField("birthdate", val),
                          )
                        }
                        className={cn(
                          "h-10 font-bold pr-10 bg-white",
                          !formData.birthdate && "border-amber-200/60",
                        )}
                      />
                      <Popover
                        open={isCalendarOpen}
                        onOpenChange={(open) => {
                          if (open && formData.birthdate) {
                            const d = new Date(formData.birthdate);
                            if (isValid(d)) setCalendarMonth(d);
                          }
                          setIsCalendarOpen(open);
                        }}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full w-9 hover:bg-transparent">
                            <CalendarIcon
                              className={cn(
                                "h-4 w-4 transition-colors",
                                isCalendarOpen ? "text-primary" : "text-foreground",
                              )}
                            />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="single"
                            captionLayout="dropdown"
                            selected={
                              formData.birthdate
                                ? new Date(formData.birthdate)
                                : undefined
                            }
                            month={calendarMonth}
                            onMonthChange={setCalendarMonth}
                            onSelect={(date) => {
                              if (date) {
                                const formatted = format(date, "yyyy-MM-dd");
                                setField("birthdate", formatted);
                                setDateInput(format(date, "MM/dd/yyyy"));
                                setCalendarMonth(date);
                                setIsCalendarOpen(false);
                              }
                            }}
                            disabled={(date) =>
                              date > new Date() || date < new Date(1950, 0, 1)
                            }
                            startMonth={new Date(1900, 0, 1)}
                            endMonth={new Date(2100, 11, 31)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-bold text-slate-800">
                      Sex *
                    </Label>
                    <div className="flex gap-4 pt-1">
                      {(
                        [
                          { value: "MALE", label: "MALE", icon: Mars },
                          { value: "FEMALE", label: "FEMALE", icon: Venus },
                        ] as const
                      ).map((sexOption) => (
                        <button
                          key={sexOption.value}
                          type="button"
                          onClick={() => {
                            setField("sex", sexOption.value as Sex);
                          }}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border-2 px-4 py-2 transition-colors text-base leading-tight uppercase",
                            formData.sex === sexOption.value
                              ? "border-primary bg-primary/5 font-bold"
                              : "border-border hover:bg-slate-50 text-slate-800",
                          )}>
                          <sexOption.icon
                            className={cn(
                              "w-4 h-4",
                              formData.sex === sexOption.value
                                ? "text-primary"
                                : "text-slate-800",
                            )}
                          />
                          <span className="font-bold">{sexOption.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-base font-bold text-slate-800">
                      Place of Birth
                    </Label>
                    <Input
                      value={formData.placeOfBirth}
                      placeholder="CITY / MUNICIPALITY"
                      className="h-10 font-bold uppercase bg-white"
                      onChange={(event) => {
                        setUpperField("placeOfBirth", event.target.value);
                      }}
                    />
                  </div>
                </div>
              </section>

              {/* SECTION 2: PREVIOUS SCHOOL INFORMATION */}
              <section className="space-y-6 text-left">
                <h3
                  className="text-xl font-bold pl-3 border-l-4"
                  style={{
                    borderColor: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))",
                    color: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))"
                  }}
                >
                  2. Previous School Information
                </h3>

                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
                  <div className="space-y-2 col-span-1 sm:col-span-2">
                    <Label className="text-base font-bold text-slate-800">
                      Last School Attended *
                    </Label>
                    <Input
                      value={formData.originSchoolName}
                      placeholder="SCHOOL NAME"
                      className="h-10 font-bold uppercase bg-white"
                      onChange={(event) => {
                        setUpperField("originSchoolName", event.target.value);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-bold text-slate-800">
                      DepEd School ID (Optional)
                    </Label>
                    <Input
                      value={formData.lastSchoolId}
                      placeholder="6-DIGIT ID"
                      maxLength={6}
                      inputMode="numeric"
                      className="h-10 font-bold bg-white"
                      onChange={(event) => {
                        setField(
                          "lastSchoolId",
                          normalizeSchoolId(event.target.value),
                        );
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-bold text-slate-800">
                      Last Grade Completed *
                    </Label>
                    <Select
                      value={formData.lastGradeCompleted}
                      onValueChange={(value) => {
                        setField("lastGradeCompleted", value);
                      }}>
                      <SelectTrigger className="h-10 font-bold bg-white">
                        <SelectValue placeholder="SELECT GRADE" />
                      </SelectTrigger>
                      <SelectContent>
                        {["6", "7", "8", "9"].map((g) => (
                          <SelectItem
                            key={g}
                            value={g}
                            className="font-bold">
                            GRADE {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-bold text-slate-800">
                      School Year Last Attended *
                    </Label>
                    <Select
                      value={formData.schoolYearLastAttended}
                      onValueChange={(value) => {
                        setField("schoolYearLastAttended", value);
                      }}>
                      <SelectTrigger className="h-10 font-bold bg-white">
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => {
                          const year = new Date().getFullYear() - i;
                          const label = `${year - 1}-${year}`;
                          return (
                            <SelectItem
                              key={label}
                              value={label}
                              className="font-bold">
                              {label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* SECTION 3: LEARNER ADDRESS */}
              <section className="space-y-6 text-left">
                <h3
                  className="text-base font-bold pl-3 border-l-4"
                  style={{
                    borderColor: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))",
                    color: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))"
                  }}
                >
                  3. Learner Address
                </h3>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-base font-bold text-slate-800">
                      House No. / Street
                    </Label>
                    <Input
                      value={formData.currentAddressHouseNoStreet}
                      placeholder="HOUSE NO / STREET"
                      className="h-10 font-bold uppercase bg-white"
                      onChange={(event) => {
                        setUpperField("currentAddressHouseNoStreet", event.target.value);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-bold text-slate-800">
                      Sitio
                    </Label>
                    <Input
                      value={formData.currentAddressSitio}
                      placeholder="SITIO / SUBDIVISION"
                      className="h-10 font-bold uppercase bg-white"
                      onChange={(event) => {
                        setUpperField("currentAddressSitio", event.target.value);
                      }}
                    />
                  </div>
                </div>

                <PhilippineAddressSelector
                  value={{
                    region: formData.currentAddressRegion,
                    province: formData.currentAddressProvince,
                    cityMunicipality: formData.currentAddressCityMunicipality,
                    barangay: formData.currentAddressBarangay,
                  }}
                  onChange={(field, val) => {
                    if (field === "region") {
                      setFormData((prev) => ({
                        ...prev,
                        currentAddressRegion: val,
                        currentAddressProvince: "",
                        currentAddressCityMunicipality: "",
                        currentAddressBarangay: "",
                      }));
                    } else if (field === "province") {
                      setFormData((prev) => ({
                        ...prev,
                        currentAddressProvince: val,
                        currentAddressCityMunicipality: "",
                        currentAddressBarangay: "",
                      }));
                    } else if (field === "cityMunicipality") {
                      setFormData((prev) => ({
                        ...prev,
                        currentAddressCityMunicipality: val,
                        currentAddressBarangay: "",
                      }));
                    } else {
                      setFormData((prev) => ({
                        ...prev,
                        currentAddressBarangay: val,
                      }));
                    }
                  }}
                  required
                />
              </section>

              {/* SECTION 4: PARENTS / GUARDIAN INFORMATION */}
              <section className="space-y-8 text-left">
                <h3
                  className="text-xl font-bold pl-3 border-l-4"
                  style={{
                    borderColor: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))",
                    color: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))"
                  }}
                >
                  4. Parents / Guardian Information
                </h3>

                {/* ROW 1: Mother's Maiden Details */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <h4 className="font-bold text-slate-800 text-base uppercase">Mother's Maiden Details</h4>
                      <p className="text-sm text-slate-500">Provide the mother's name exactly as it appears on the birth certificate.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                      <Checkbox
                        id="hasNoMother"
                        checked={formData.hasNoMother}
                        onCheckedChange={(checked) => setField("hasNoMother", checked === true)}
                      />
                      <Label htmlFor="hasNoMother" className="text-sm font-bold uppercase text-slate-700 cursor-pointer">
                        Record Unknown / Deceased
                      </Label>
                    </div>
                  </div>

                  <div className={cn("grid gap-4 md:grid-cols-3 transition-opacity duration-200", formData.hasNoMother && "opacity-40 pointer-events-none")}>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase text-slate-600">Maiden Last Name</Label>
                      <Input
                        value={formData.hasNoMother ? "N/A" : formData.mother.lastName}
                        disabled={formData.hasNoMother}
                        placeholder="LAST NAME"
                        className="h-10 font-bold uppercase bg-white border-slate-300"
                        onChange={(e) => setContactField("mother", "lastName", e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase text-slate-600">First Name</Label>
                      <Input
                        value={formData.hasNoMother ? "N/A" : formData.mother.firstName}
                        disabled={formData.hasNoMother}
                        placeholder="FIRST NAME"
                        className="h-10 font-bold uppercase bg-white border-slate-300"
                        onChange={(e) => setContactField("mother", "firstName", e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase text-slate-600">Middle Name <span className="text-slate-400 font-normal">(Optional)</span></Label>
                      <Input
                        value={formData.hasNoMother ? "N/A" : formData.mother.middleName}
                        disabled={formData.hasNoMother}
                        placeholder="MIDDLE NAME"
                        className="h-10 font-bold uppercase bg-white border-slate-300"
                        onChange={(e) => setContactField("mother", "middleName", e.target.value.toUpperCase())}
                      />
                    </div>
                  </div>
                </div>

                {/* ROW 2: Father's Details */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <h4 className="font-bold text-slate-800 text-base uppercase">Father's Details</h4>
                      <p className="text-sm text-slate-500">Provide the father's full name.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                      <Checkbox
                        id="hasNoFather"
                        checked={formData.hasNoFather}
                        onCheckedChange={(checked) => setField("hasNoFather", checked === true)}
                      />
                      <Label htmlFor="hasNoFather" className="text-sm font-bold uppercase text-slate-700 cursor-pointer">
                        Record Unknown / Deceased
                      </Label>
                    </div>
                  </div>

                  <div className={cn("grid gap-4 md:grid-cols-4 transition-opacity duration-200", formData.hasNoFather && "opacity-40 pointer-events-none")}>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase text-slate-600">Last Name</Label>
                      <Input
                        value={formData.hasNoFather ? "N/A" : formData.father.lastName}
                        disabled={formData.hasNoFather}
                        placeholder="LAST NAME"
                        className="h-10 font-bold uppercase bg-white border-slate-300"
                        onChange={(e) => setContactField("father", "lastName", e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase text-slate-600">First Name</Label>
                      <Input
                        value={formData.hasNoFather ? "N/A" : formData.father.firstName}
                        disabled={formData.hasNoFather}
                        placeholder="FIRST NAME"
                        className="h-10 font-bold uppercase bg-white border-slate-300"
                        onChange={(e) => setContactField("father", "firstName", e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase text-slate-600">Middle Name <span className="text-slate-400 font-normal">(Optional)</span></Label>
                      <Input
                        value={formData.hasNoFather ? "N/A" : formData.father.middleName}
                        disabled={formData.hasNoFather}
                        placeholder="MIDDLE NAME"
                        className="h-10 font-bold uppercase bg-white border-slate-300"
                        onChange={(e) => setContactField("father", "middleName", e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase text-slate-600">Suffix <span className="text-slate-400 font-normal">(Optional)</span></Label>
                      <Select 
                        value={formData.hasNoFather ? "" : formData.father.extensionName} 
                        onValueChange={(val) => setContactField("father", "extensionName", val === "NONE" ? "" : val)}
                        disabled={formData.hasNoFather}
                      >
                        <SelectTrigger className="h-10 bg-white font-bold text-slate-800 border-slate-300">
                          <SelectValue placeholder="SELECT" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">None</SelectItem>
                          <SelectItem value="JR.">Jr.</SelectItem>
                          <SelectItem value="SR.">Sr.</SelectItem>
                          <SelectItem value="II">II</SelectItem>
                          <SelectItem value="III">III</SelectItem>
                          <SelectItem value="IV">IV</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* ROW 3: Primary Residence Gateway */}
                <div className="pt-6 border-t border-slate-200">
                  <div className="mb-4">
                    <Label className="text-base font-bold text-slate-800 uppercase">Primary Caregiver</Label>
                    <p className="text-sm text-slate-500">Who does the learner permanently reside with?</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {(!formData.hasNoMother) && (
                      <button
                        type="button"
                        onClick={() => setField("primaryContact", "MOTHER")}
                        className={cn(
                          "flex items-center gap-2 px-5 py-3 rounded-full border-2 font-bold uppercase text-sm transition-all",
                          formData.primaryContact === "MOTHER"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <Venus className="w-5 h-5" />
                        Mother
                      </button>
                    )}
                    {(!formData.hasNoFather) && (
                      <button
                        type="button"
                        onClick={() => setField("primaryContact", "FATHER")}
                        className={cn(
                          "flex items-center gap-2 px-5 py-3 rounded-full border-2 font-bold uppercase text-sm transition-all",
                          formData.primaryContact === "FATHER"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <Mars className="w-5 h-5" />
                        Father
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setField("primaryContact", "GUARDIAN")}
                      className={cn(
                        "flex items-center gap-2 px-5 py-3 rounded-full border-2 font-bold uppercase text-sm transition-all",
                        formData.primaryContact === "GUARDIAN"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <User className="w-5 h-5" />
                      Legal Guardian
                    </button>
                  </div>
                </div>

                {/* ROW 4: Dynamic Guardian Shell */}
                {formData.primaryContact === "GUARDIAN" && (
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-top-4 duration-300">
                    <h4 className="font-bold text-slate-800 text-sm uppercase mb-4">Guardian Identity Details</h4>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase text-slate-600">Last Name</Label>
                        <Input
                          value={formData.guardian.lastName}
                          placeholder="LAST NAME"
                          className="h-10 font-bold uppercase bg-white border-slate-300"
                          onChange={(e) => setContactField("guardian", "lastName", e.target.value.toUpperCase())}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase text-slate-600">First Name</Label>
                        <Input
                          value={formData.guardian.firstName}
                          placeholder="FIRST NAME"
                          className="h-10 font-bold uppercase bg-white border-slate-300"
                          onChange={(e) => setContactField("guardian", "firstName", e.target.value.toUpperCase())}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase text-slate-600">Relationship to Learner</Label>
                        <Input
                          value={formData.guardianRelationship}
                          placeholder="AUNT / GRANDPARENT"
                          className="h-10 font-bold uppercase bg-white border-slate-300"
                          onChange={(e) => setUpperField("guardianRelationship", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ROW 5: Master Contact Pipe */}
                <div className="pt-6 border-t border-slate-200">
                  <div className="max-w-md space-y-2">
                    <Label className="text-base font-bold text-slate-800 uppercase flex items-center gap-2">
                      Primary Contact Number
                      <span className="text-destructive text-sm">*</span>
                    </Label>
                    <Input
                      value={formData.contactNumber}
                      placeholder="09XXXXXXXXX"
                      maxLength={11}
                      inputMode="numeric"
                      className="h-12 text-lg font-bold bg-white border-2 border-slate-300 tracking-wider"
                      onChange={(event) => {
                        setField(
                          "contactNumber",
                          normalizeContactNumber(event.target.value),
                        );
                      }}
                    />
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      All emergency and DepEd notifications will be sent to this number.
                    </p>
                  </div>
                </div>

              </section>

              {/* SECTION 5: PHYSICAL REQUIREMENTS SUBMITTED */}
              <section className="space-y-6 text-left">
                <h3
                  className="text-xl font-bold pl-3 border-l-4"
                  style={{
                    borderColor: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))",
                    color: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))"
                  }}
                >
                  5. Physical Requirements Submitted
                </h3>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-3">
                    <Label className="text-base font-bold text-slate-800">
                      Final General Average (SF9) *
                    </Label>
                    <Input
                      value={formData.finalGeneralAverage}
                      placeholder="88.50"
                      className="h-10 font-bold bg-white"
                      inputMode="decimal"
                      onChange={(event) => {
                        const val = event.target.value;
                        if (val === "" || /^(\d+)?(\.\d{0,2})?$/.test(val)) {
                          const num = val === "" ? null : parseFloat(val);
                          if (num === null || (!isNaN(num) && num <= 100)) {
                            setField("finalGeneralAverage", val);
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
                    <Checkbox
                      id="isSf9Submitted"
                      checked={formData.isSf9Submitted}
                      onCheckedChange={(checked) => {
                        setField("isSf9Submitted", checked === true);
                      }}
                    />
                    <Label
                      htmlFor="isSf9Submitted"
                      className="text-base font-semibold text-slate-700 cursor-pointer select-none">
                      Original SF9 (Report Card / Learner Progress)
                    </Label>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
                    <Checkbox
                      id="isPsaBirthCertPresented"
                      checked={formData.isPsaBirthCertPresented}
                      onCheckedChange={(checked) => {
                        setField("isPsaBirthCertPresented", checked === true);
                      }}
                    />
                    <Label
                      htmlFor="isPsaBirthCertPresented"
                      className="text-base font-semibold text-slate-700 cursor-pointer select-none">
                      PSA / NSA Birth Certificate Verified
                    </Label>
                  </div>
                </div>
              </section>

              {/* 6. ACTION FOOTER */}
              <div className="flex items-center justify-between gap-4 pt-6 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 px-6 font-bold bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                  onClick={() => navigate("/dashboard")}
                  disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="h-11 px-6 font-bold text-white shadow-none border-none animate-in fade-in zoom-in duration-200"
                  style={{ backgroundColor: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))" }}
                  disabled={submitting}
                  onClick={() => { void handleSubmit(); }}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving Profile...
                    </>
                  ) : (
                    "Save Learner Profile & Select Class Section →"
                  )}
                </Button>
              </div>

            </fieldset>
          </form>
        </CardContent>
      </Card>

      {/* 5. POST-SUBMISSION MODAL DIALOG */}
      <Dialog open={showSectionModal} onOpenChange={(open) => { if (!open) handleSkipSectionAssignment(); }}>
        <DialogContent className="sm:max-w-[460px] text-left p-6 bg-white rounded-xl shadow-lg border border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-800 tracking-wide">
              Assign Late Enrollee to a Class Section
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-base font-semibold text-slate-500 leading-normal">
              Select an active {createdGradeLevelName} section with available physical seating.
            </p>

            <div className="space-y-2">
              <Label className="text-base font-bold text-slate-700">Official Enrollment Date *</Label>
              <Input
                type="date"
                value={lateEnrollmentDate}
                max={format(new Date(), "yyyy-MM-dd")}
                className="h-10 font-bold"
                onChange={(e) => setLateEnrollmentDate(e.target.value)}
              />
            </div>

            <div className="space-y-3 max-h-[220px] overflow-y-auto border border-slate-100 rounded-lg p-3 bg-slate-50/50">
              {loadingModalSections ? (
                <div className="flex items-center justify-center py-6 text-base text-slate-400 gap-2 font-bold">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading sections...
                </div>
              ) : modalSections.length === 0 ? (
                <p className="text-base text-slate-400 text-center py-4 font-bold">
                  No active sections found for this grade level.
                </p>
              ) : (
                modalSections.map((s) => {
                  const isFull = s.enrolledCount >= s.maxCapacity;
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border bg-white transition-all cursor-pointer",
                        selectedModalSectionId === s.id ? "border-slate-800 ring-1 ring-slate-800 bg-slate-50" : "border-slate-200 hover:border-slate-300",
                        isFull && "opacity-60 cursor-not-allowed bg-slate-50"
                      )}
                      onClick={() => {
                        if (!isFull) {
                          setSelectedModalSectionId(s.id);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="modalSection"
                          disabled={isFull}
                          checked={selectedModalSectionId === s.id}
                          onChange={() => setSelectedModalSectionId(s.id)}
                          className="h-4 w-4 accent-slate-800 cursor-pointer"
                        />
                        <span className="text-base font-bold text-slate-800">
                          Section {s.name}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-slate-500 font-mono">
                        {isFull ? (
                          <span className="text-rose-600 font-black">Full Capacity</span>
                        ) : (
                          `${s.enrolledCount} / ${s.maxCapacity} Learners`
                        )}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <DialogFooter className="sm:justify-between flex gap-3 mt-2">
            <Button
              variant="outline"
              onClick={handleSkipSectionAssignment}
              className="h-11 font-bold bg-white text-slate-700 border-slate-200 hover:bg-slate-50 w-1/2">
              Skip for Now
            </Button>
            <Button
              disabled={submitting || !selectedModalSectionId}
              onClick={handleConfirmSectionAssignment}
              className="h-11 font-bold text-white w-1/2 shadow-none border-none"
              style={{ backgroundColor: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))" }}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
                  Assigning...
                </>
              ) : (
                "Confirm Assignment"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Capacity Override Warning Modal */}
      <Dialog
        open={isCapacityOverrideOpen}
        onOpenChange={setIsCapacityOverrideOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 bg-amber-50 border-b border-amber-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <DialogTitle className="text-base font-black uppercase text-amber-900">
                Section Capacity Reached
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="px-6 py-5 bg-background space-y-3">
            <p className="text-base leading-tight font-bold text-foreground">
              The selected section has reached its maximum DepEd capacity. Are you sure you want to proceed with this assignment?
            </p>
            <p className="text-base text-amber-700 font-bold">
              This action will create an over-capacity record. Ensure administrative approval has been obtained.
            </p>
          </div>
          <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border flex items-center justify-end gap-2">
            <Button
              variant="outline"
              className="font-bold uppercase text-base"
              onClick={() => {
                setIsCapacityOverrideOpen(false);
                setPendingOverrideContext(null);
              }}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold uppercase text-base px-6 shadow-none border-none"
              onClick={() => {
                if (!pendingOverrideContext) return;
                setIsCapacityOverrideOpen(false);
                void doInlineSlotWithOverride(
                  pendingOverrideContext.enrollmentApplicationId,
                  pendingOverrideContext.sectionId,
                  pendingOverrideContext.date,
                );
                setPendingOverrideContext(null);
              }}>
              Confirm Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
