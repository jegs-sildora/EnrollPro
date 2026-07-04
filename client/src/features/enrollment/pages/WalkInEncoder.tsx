import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Calendar as CalendarIcon, AlertTriangle, Search, Loader2, Mars, Venus, User } from "lucide-react";
import { isAxiosError } from "axios";
import { format, isValid, parse, isAfter, isBefore } from "date-fns";
import { sileo } from "sileo";
import { useHeaderStore } from "@/store/header.slice";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
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
  const [errors, setErrors] = useState<Partial<Record<keyof WalkInFormState | string, string>>>({});
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState(false);
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

  const [duplicateInfo, setDuplicateInfo] = useState<any | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  useEffect(() => {
    const lrnVal = formData.lrn.trim();
    const fName = formData.firstName.trim();
    const lName = formData.lastName.trim();
    const bDate = formData.birthdate;

    const hasValidLrn = lrnVal.length === 12;
    const hasValidDemographics = fName.length > 0 && lName.length > 0 && bDate.length > 0;

    if (!hasValidLrn && !hasValidDemographics) {
      setDuplicateInfo(null);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const response = await api.post("/learner/check-duplicate", {
          lrn: hasValidLrn ? lrnVal : undefined,
          firstName: fName || undefined,
          lastName: lName || undefined,
          birthdate: bDate || undefined,
        });

        if (response.data?.duplicateFound) {
          setDuplicateInfo(response.data.learner);
          setShowDuplicateModal(true);
        } else {
          setDuplicateInfo(null);
        }
      } catch (err) {
        console.error("Duplicate check failed", err);
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [formData.lrn, formData.firstName, formData.lastName, formData.birthdate]);

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
    const newErrors: Partial<Record<keyof WalkInFormState | string, string>> = {};

    if (!formData.lastName.trim()) newErrors.lastName = "Learner's last name is required.";
    if (!formData.firstName.trim()) newErrors.firstName = "Learner's first name is required.";
    if (!formData.birthdate) newErrors.birthdate = "Learner's birthdate is required.";
    if (!formData.sex) newErrors.sex = "Learner's sex is required.";
    if (!formData.gradeLevelId) newErrors.gradeLevelId = "Please select a grade level.";

    if (!formData.currentAddressBarangay.trim()) newErrors.currentAddressBarangay = "Barangay is required.";
    if (!formData.currentAddressCityMunicipality.trim()) newErrors.currentAddressCityMunicipality = "City/Municipality is required.";
    if (!formData.currentAddressRegion.trim()) newErrors.currentAddressRegion = "Region is required.";
    if (!formData.currentAddressProvince.trim()) newErrors.currentAddressProvince = "Province is required.";

    if (!/^\d{12}$/.test(formData.lrn.trim())) {
      newErrors.lrn = "Please provide a valid 12-digit Learner Reference Number.";
    }

    if (formData.learnerType === "TRANSFEREE" && !formData.originSchoolName.trim()) {
      newErrors.originSchoolName = "Origin school name is required for transferring learners.";
    }

    if (formData.lastSchoolId.trim() && !/^\d{6}$/.test(formData.lastSchoolId.trim())) {
      newErrors.lastSchoolId = "School ID must be exactly 6 digits.";
    }

    if (!formData.hasNoMother) {
      if (!formData.mother.firstName.trim()) newErrors.motherFirstName = "Mother's first name is required.";
      if (!formData.mother.lastName.trim()) newErrors.motherLastName = "Mother's maiden last name is required.";
    }

    if (!formData.contactNumber.trim() || !/^\d{11}$/.test(formData.contactNumber.trim())) {
      newErrors.contactNumber = "Please provide a valid 11-digit contact number.";
    }

    if (isUnderGuardianCare) {
      if (!formData.guardian.firstName.trim()) newErrors.guardianFirstName = "Guardian's first name is required.";
      if (!formData.guardian.lastName.trim()) newErrors.guardianLastName = "Guardian's last name is required.";
      if (!formData.guardianRelationship.trim()) newErrors.guardianRelationship = "Please specify the guardian's relationship to the learner.";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      sileo.error({
        title: "Incomplete Form",
        description: "Please check the form for missing or invalid information.",
      });

      setTimeout(() => {
        const firstError = document.querySelector(".text-destructive.text-sm.mt-1");
        if (firstError) {
          firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);

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
    setDuplicateInfo(null);
    setShowDuplicateModal(false);
  };

  const handleSubmit = () => {
    if (duplicateInfo) {
      setShowDuplicateModal(true);
      return;
    }
    if (validateForm()) {
      setShowSubmitConfirmModal(true);
    }
  };

  const executeSubmit = async () => {


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

  const setTitle = useHeaderStore((s) => s.setTitle);

  useEffect(() => {
    setTitle("Late Enrollee Form");
    return () => setTitle(null);
  }, [setTitle]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 text-left">
        <div className="space-y-1">
          <p className="text-base leading-tight text-foreground font-extrabold">
            Encode submitted Basic Education Enrollment Forms (BEEF) for late enrollees and transferees.
          </p>
        </div>
        <div className="text-base font-extrabold text-foreground whitespace-nowrap bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-300 sm:mt-1">
          Late Entry: S.Y. {activeSchoolYearLabel || "2026–2027"}
        </div>
      </div>

      {/* 2. THE LRN FRONT-DOOR INTERCEPTOR */}
      <Card className="border border-slate-200 bg-white shadow-sm rounded-xl mb-6">
        <CardContent className="p-5 md:p-6 flex flex-col space-y-4 text-left">
          <div className="space-y-2">
            <Label htmlFor="interceptorLrn" className="text-base font-extrabold text-foreground">
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
                  className="pl-11 h-12 text-lg font-extrabold tracking-wider text-foreground rounded-xl"
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
                className="h-12 w-32 font-extrabold uppercase tracking-wider text-white border-none shadow-none rounded-xl shrink-0"
                style={{ backgroundColor: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))" }}
              >
                {isSearchingLrn ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Search"
                )}
              </Button>
            </div>
            <p className="text-base font-extrabold">
              Checks local school records to prevent duplicate enrollment.
            </p>
          </div>

          {/* DYNAMIC FEEDBACK ZONE */}
          {showNoLrnBanner && !isFormUnlocked && (
            <div className="w-full p-4 rounded-xl border border-amber-200 bg-amber-50 text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-start sm:items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                <p className="text-base font-extrabold text-amber-900">
                  LRN not found in database. Encode as a brand new learner profile?
                </p>
              </div>
              <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="h-9 px-4 font-extrabold bg-white text-slate-700 border-amber-200 hover:bg-amber-100 flex-1 sm:flex-none"
                  onClick={() => {
                    setShowNoLrnBanner(false);
                    setInterceptorLrn("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="h-9 px-4 font-extrabold bg-amber-600 text-white hover:bg-amber-700 shadow-none border-none flex-1 sm:flex-none"
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
                <span className="text-emerald-700 font-extrabold text-xs">✓</span>
              </div>
              <p className="text-base font-extrabold text-emerald-900">
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
                  className="text-xl font-extrabold pl-3 border-l-4"
                  style={{
                    borderColor: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))",
                    color: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))"
                  }}
                >
                  1. Learner Information
                </h3>

                {hydrationContext && (
                  <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 mb-4">
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-[11px] font-extrabold uppercase">
                      Record Found: {hydrationContext.source === "ENROLLMENT" ? "Pending Queue Record" : "Early Registrant"}
                    </Badge>
                    <p className="text-base font-extrabold uppercase text-emerald-800">
                      Status: {hydrationContext.status.replace(/_/g, " ")}
                    </p>
                    {hydratedApplicantLabel && hydratedApplicantType !== "REGULAR" && (
                      <p className="text-base leading-tight font-extrabold text-emerald-955">
                        Curriculum: {hydratedApplicantLabel} {hydrationContext.status === "PENDING_BEEF" ? "- PASSER" : ""}
                      </p>
                    )}
                  </div>
                )}

                {/* Row 1 (Academic Assignment) */}
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label className="text-base font-extrabold text-foreground">
                      Learner Reference Number (LRN) *
                    </Label>
                    <Input
                      value={formData.lrn}
                      disabled={true}
                      className="h-10 font-extrabold bg-slate-100 border-slate-200 text-slate-700 disabled:opacity-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-extrabold text-foreground">
                      Learner Type *
                    </Label>
                    <Select
                      value={formData.learnerType}
                      onValueChange={(val) => setField("learnerType", val as LearnerType)}
                    >
                      <SelectTrigger className="h-10 font-extrabold bg-white">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NEW_ENROLLEE" className="font-extrabold">New Enrollee (Grade 7 Entry)</SelectItem>
                        <SelectItem value="TRANSFEREE" className="font-extrabold">Transferee (Move-In from Other School)</SelectItem>
                        <SelectItem value="RETURNING" className="font-extrabold">Returning Learner (Balik-Aral)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-extrabold text-foreground">
                      Grade Level *
                    </Label>
                    <Select
                      value={formData.gradeLevelId}
                      onValueChange={(val) => setField("gradeLevelId", val)}
                      disabled={loadingGradeLevels}
                    >
                      <SelectTrigger className="h-10 font-extrabold bg-white">
                        <SelectValue placeholder={loadingGradeLevels ? "Loading grades..." : "Select grade"} />
                      </SelectTrigger>
                      <SelectContent>
                        {gradeLevels.map((g) => (
                          <SelectItem key={g.id} value={String(g.id)} className="font-extrabold">
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-extrabold text-foreground">
                      Prior Academic Status *
                    </Label>
                    <Select
                      value={formData.academicStatus}
                      onValueChange={(val) => setField("academicStatus", val as AcademicStatus)}
                    >
                      <SelectTrigger className="h-10 font-extrabold bg-white">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PROMOTED" className="font-extrabold">Promoted</SelectItem>
                        <SelectItem value="CONDITIONALLY_PROMOTED" className="font-extrabold">Conditional (Irregular)</SelectItem>
                        <SelectItem value="RETAINED" className="font-extrabold">Retained (Held Back)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 2 (Legal Identity) */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-base font-extrabold text-foreground">
                      Last Name *
                    </Label>
                    <Input
                      value={formData.lastName}
                      placeholder="LAST NAME"
                      className="h-10 font-extrabold uppercase bg-white"
                      onChange={(e) => setUpperField("lastName", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-extrabold text-foreground">
                      First Name *
                    </Label>
                    <Input
                      value={formData.firstName}
                      placeholder="FIRST NAME"
                      className="h-10 font-extrabold uppercase bg-white"
                      onChange={(e) => setUpperField("firstName", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-extrabold text-foreground">
                      Middle Name
                    </Label>
                    <Input
                      value={formData.middleName}
                      placeholder="Leave blank if none"
                      className="h-10 font-extrabold uppercase bg-white"
                      onChange={(e) => setUpperField("middleName", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-extrabold text-foreground">
                      Extension Name
                    </Label>
                    <Select
                      value={formData.extensionName || "NONE"}
                      onValueChange={(val) => setField("extensionName", val === "NONE" ? "" : val)}
                    >
                      <SelectTrigger className="h-10 font-extrabold bg-white">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE" className="font-extrabold">None</SelectItem>
                        <SelectItem value="JR" className="font-extrabold">Jr.</SelectItem>
                        <SelectItem value="II" className="font-extrabold">II</SelectItem>
                        <SelectItem value="III" className="font-extrabold">III</SelectItem>
                        <SelectItem value="IV" className="font-extrabold">IV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 3 (Birthdate, Sex, Place of Birth) */}
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label className="text-base font-extrabold text-foreground">
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
                          "h-10 font-extrabold pr-10 bg-white",
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
                    <Label className="text-base font-extrabold text-foreground">
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
                              ? "border-primary bg-primary/5 font-extrabold"
                              : "border-border hover:bg-slate-50 text-foreground",
                          )}>
                          <sexOption.icon
                            className={cn(
                              "w-4 h-4",
                              formData.sex === sexOption.value
                                ? "text-primary"
                                : "text-foreground",
                            )}
                          />
                          <span className="font-extrabold">{sexOption.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-base font-extrabold text-foreground">
                      Place of Birth
                    </Label>
                    <Input
                      value={formData.placeOfBirth}
                      placeholder="CITY / MUNICIPALITY"
                      className="h-10 font-extrabold uppercase bg-white"
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
                  className="text-xl font-extrabold pl-3 border-l-4"
                  style={{
                    borderColor: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))",
                    color: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))"
                  }}
                >
                  2. Previous School Information
                </h3>

                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
                  <div className="space-y-2 col-span-1 sm:col-span-2">
                    <Label className="text-base font-extrabold text-foreground">
                      Last School Attended *
                    </Label>
                    <Input
                      value={formData.originSchoolName}
                      placeholder="SCHOOL NAME"
                      className="h-10 font-extrabold uppercase bg-white"
                      onChange={(event) => {
                        setUpperField("originSchoolName", event.target.value);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-extrabold text-foreground">
                      DepEd School ID (Optional)
                    </Label>
                    <Input
                      value={formData.lastSchoolId}
                      placeholder="6-DIGIT ID"
                      maxLength={6}
                      inputMode="numeric"
                      className="h-10 font-extrabold bg-white"
                      onChange={(event) => {
                        setField(
                          "lastSchoolId",
                          normalizeSchoolId(event.target.value),
                        );
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-extrabold text-foreground">
                      Last Grade Completed *
                    </Label>
                    <Select
                      value={formData.lastGradeCompleted}
                      onValueChange={(value) => {
                        setField("lastGradeCompleted", value);
                      }}>
                      <SelectTrigger className="h-10 font-extrabold bg-white">
                        <SelectValue placeholder="SELECT GRADE" />
                      </SelectTrigger>
                      <SelectContent>
                        {["6", "7", "8", "9"].map((g) => (
                          <SelectItem
                            key={g}
                            value={g}
                            className="font-extrabold">
                            GRADE {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-extrabold text-foreground">
                      School Year Last Attended *
                    </Label>
                    <Select
                      value={formData.schoolYearLastAttended}
                      onValueChange={(value) => {
                        setField("schoolYearLastAttended", value);
                      }}>
                      <SelectTrigger className="h-10 font-extrabold bg-white">
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
                              className="font-extrabold">
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
                  className="text-xl font-extrabold pl-3 border-l-4"
                  style={{
                    borderColor: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))",
                    color: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))"
                  }}
                >
                  3. Learner Address
                </h3>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-base font-extrabold text-foreground uppercase">
                      House No. / Street
                    </Label>
                    <Input
                      value={formData.currentAddressHouseNoStreet}
                      placeholder="HOUSE NO. / STREET"
                      className="h-10 font-extrabold uppercase bg-white"
                      onChange={(event) => {
                        setUpperField("currentAddressHouseNoStreet", event.target.value);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-extrabold text-foreground uppercase">
                      Purok / Sitio / Subdivision
                    </Label>
                    <Input
                      value={formData.currentAddressSitio}
                      placeholder="PUROK / Sitio / Subdivision"
                      className="h-10 font-extrabold uppercase bg-white"
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
                  className="text-xl font-extrabold pl-3 border-l-4"
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
                      <h4 className="font-extrabold text-foreground text-base uppercase">Mother's Maiden Details</h4>
                      <p className="text-sm text-foreground/80">Provide the mother's name exactly as it appears on the birth certificate.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                      <Checkbox
                        id="hasNoMother"
                        checked={formData.hasNoMother}
                        onCheckedChange={(checked) => setField("hasNoMother", checked === true)}
                      />
                      <Label htmlFor="hasNoMother" className="text-sm font-extrabold uppercase text-slate-700 cursor-pointer">
                        Record Unknown / Deceased
                      </Label>
                    </div>
                  </div>

                  <div className={cn("grid gap-4 md:grid-cols-3 transition-opacity duration-200", formData.hasNoMother && "opacity-40 pointer-events-none")}>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-extrabold uppercase text-slate-600">Maiden Last Name</Label>
                      <Input
                        value={formData.hasNoMother ? "N/A" : formData.mother.lastName}
                        disabled={formData.hasNoMother}
                        placeholder="LAST NAME"
                        className="h-10 font-extrabold uppercase bg-white border-slate-300"
                        onChange={(e) => setContactField("mother", "lastName", e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-extrabold uppercase text-slate-600">First Name</Label>
                      <Input
                        value={formData.hasNoMother ? "N/A" : formData.mother.firstName}
                        disabled={formData.hasNoMother}
                        placeholder="FIRST NAME"
                        className="h-10 font-extrabold uppercase bg-white border-slate-300"
                        onChange={(e) => setContactField("mother", "firstName", e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-extrabold uppercase text-slate-600">Middle Name <span className="text-slate-400 font-normal">(Optional)</span></Label>
                      <Input
                        value={formData.hasNoMother ? "N/A" : formData.mother.middleName}
                        disabled={formData.hasNoMother}
                        placeholder="MIDDLE NAME"
                        className="h-10 font-extrabold uppercase bg-white border-slate-300"
                        onChange={(e) => setContactField("mother", "middleName", e.target.value.toUpperCase())}
                      />
                    </div>
                  </div>
                </div>

                {/* ROW 2: Father's Details */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <h4 className="font-extrabold text-foreground text-base uppercase">Father's Details</h4>
                      <p className="text-sm text-foreground/80">Provide the father's full name.</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                      <Checkbox
                        id="hasNoFather"
                        checked={formData.hasNoFather}
                        onCheckedChange={(checked) => setField("hasNoFather", checked === true)}
                      />
                      <Label htmlFor="hasNoFather" className="text-sm font-extrabold uppercase text-slate-700 cursor-pointer">
                        Record Unknown / Deceased
                      </Label>
                    </div>
                  </div>

                  <div className={cn("grid gap-4 md:grid-cols-4 transition-opacity duration-200", formData.hasNoFather && "opacity-40 pointer-events-none")}>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-extrabold uppercase text-slate-600">Last Name</Label>
                      <Input
                        value={formData.hasNoFather ? "N/A" : formData.father.lastName}
                        disabled={formData.hasNoFather}
                        placeholder="LAST NAME"
                        className="h-10 font-extrabold uppercase bg-white border-slate-300"
                        onChange={(e) => setContactField("father", "lastName", e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-extrabold uppercase text-slate-600">First Name</Label>
                      <Input
                        value={formData.hasNoFather ? "N/A" : formData.father.firstName}
                        disabled={formData.hasNoFather}
                        placeholder="FIRST NAME"
                        className="h-10 font-extrabold uppercase bg-white border-slate-300"
                        onChange={(e) => setContactField("father", "firstName", e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-extrabold uppercase text-slate-600">Middle Name <span className="text-slate-400 font-normal">(Optional)</span></Label>
                      <Input
                        value={formData.hasNoFather ? "N/A" : formData.father.middleName}
                        disabled={formData.hasNoFather}
                        placeholder="MIDDLE NAME"
                        className="h-10 font-extrabold uppercase bg-white border-slate-300"
                        onChange={(e) => setContactField("father", "middleName", e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-extrabold uppercase text-slate-600">Suffix <span className="text-slate-400 font-normal">(Optional)</span></Label>
                      <Select
                        value={formData.hasNoFather ? "" : formData.father.extensionName}
                        onValueChange={(val) => setContactField("father", "extensionName", val === "NONE" ? "" : val)}
                        disabled={formData.hasNoFather}
                      >
                        <SelectTrigger className="h-10 bg-white font-extrabold text-foreground border-slate-300">
                          <SelectValue placeholder="SELECT" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">None</SelectItem>
                          <SelectItem value="JR.">Jr.</SelectItem>
                          <SelectItem value="SR.">Sr.</SelectItem>
                          <SelectItem value="II">II</SelectItem>
                          <SelectItem value="III">III</SelectItem>
                          <SelectItem value="IV">IV</SelectItem>
                        </SelectContent>\n                      </Select>\n                      {errors.sex && <p className="text-destructive text-sm mt-1">{errors.sex}</p>}
                    </div>
                  </div>
                </div>

                {/* ROW 3 & 4: Primary Residence Gateway & Contact Number */}
                <div className="pt-6 border-t border-slate-200">
                  <div className="grid gap-8 md:grid-cols-2">
                    {/* Primary Caregiver */}
                    <div>
                      <div className="mb-4">
                        <Label className="text-base font-extrabold text-foreground uppercase">Primary Caregiver</Label>
                        <p className="text-sm text-foreground/80">Who does the learner permanently reside with?</p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {(!formData.hasNoMother) && (
                          <button
                            type="button"
                            onClick={() => setField("primaryContact", "MOTHER")}
                            className={cn(
                              "flex items-center gap-2 px-5 py-3 rounded-full border-2 font-extrabold uppercase text-sm transition-all",
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
                              "flex items-center gap-2 px-5 py-3 rounded-full border-2 font-extrabold uppercase text-sm transition-all",
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
                            "flex items-center gap-2 px-5 py-3 rounded-full border-2 font-extrabold uppercase text-sm transition-all",
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

                    {/* Master Contact Pipe */}
                    <div>
                      <div className="mb-4 space-y-1">
                        <Label className="text-base font-extrabold text-foreground uppercase flex items-center gap-2">
                          Primary Contact Number
                          <span className="text-destructive text-sm">*</span>
                        </Label>
                        <p className="text-sm text-foreground/80">All emergency and school notifications will be sent to this number.</p>
                      </div>
                      <Input
                        value={formData.contactNumber}
                        placeholder="09XXXXXXXXX"
                        maxLength={11}
                        inputMode="numeric"
                        className="h-12 max-w-sm text-lg font-extrabold bg-white border-2 border-slate-300 tracking-wider"
                        onChange={(event) => {
                          setField(
                            "contactNumber",
                            normalizeContactNumber(event.target.value),
                          );
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Dynamic Guardian Shell */}
                {formData.primaryContact === "GUARDIAN" && (
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-top-4 duration-300">
                    <h4 className="font-extrabold text-foreground text-sm uppercase mb-4">Guardian Identity Details</h4>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-extrabold uppercase text-slate-600">Last Name</Label>
                        <Input
                          value={formData.guardian.lastName}
                          placeholder="LAST NAME"
                          className="h-10 font-extrabold uppercase bg-white border-slate-300"
                          onChange={(e) => setContactField("guardian", "lastName", e.target.value.toUpperCase())}
                        />\n                      </div>\n                      {errors.birthdate && <p className="text-destructive text-sm mt-1">{errors.birthdate}</p>}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-extrabold uppercase text-slate-600">First Name</Label>
                        <Input
                          value={formData.guardian.firstName}
                          placeholder="FIRST NAME"
                          className="h-10 font-extrabold uppercase bg-white border-slate-300"
                          onChange={(e) => setContactField("guardian", "firstName", e.target.value.toUpperCase())}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-extrabold uppercase text-slate-600">Relationship to Learner</Label>
                        <Input
                          value={formData.guardianRelationship}
                          placeholder="AUNT / GRANDPARENT"
                          className="h-10 font-extrabold uppercase bg-white border-slate-300"
                          onChange={(e) => setUpperField("guardianRelationship", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}

              </section>

              {/* SECTION 5: PHYSICAL REQUIREMENTS SUBMITTED */}
              <section className="space-y-6 text-left">
                <h3
                  className="text-xl font-extrabold pl-3 border-l-4"
                  style={{
                    borderColor: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))",
                    color: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))"
                  }}
                >
                  5. Physical Requirements Submitted
                </h3>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-3">
                    <Label className="text-base font-extrabold text-foreground">
                      Final General Average (SF9) *
                    </Label>
                    <Input
                      value={formData.finalGeneralAverage}
                      placeholder="88.50"
                      className="h-10 font-extrabold bg-white"
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
                  className="h-11 px-6 font-extrabold bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                  onClick={() => navigate("/dashboard")}
                  disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="h-11 px-6 font-extrabold text-white shadow-none border-none animate-in fade-in zoom-in duration-200"
                  style={{ backgroundColor: accentHsl ? `hsl(${accentHsl})` : "hsl(var(--primary))" }}
                  disabled={submitting || Boolean(duplicateInfo)}
                  onClick={() => { handleSubmit(); }}>
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
        <DialogContent className="w-full max-w-3xl text-left p-6 bg-white rounded-xl shadow-lg border border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-foreground tracking-wide">
              Assign Late Enrollee to a Class Section
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-base font-semibold text-foreground/80 leading-normal">
              Select an active {createdGradeLevelName} section with available physical seating.
            </p>

            <div className="space-y-2">
              <Label className="text-base font-extrabold text-slate-700">Official Enrollment Date *</Label>
              <Input
                type="date"
                value={lateEnrollmentDate}
                max={format(new Date(), "yyyy-MM-dd")}
                className="h-10 font-extrabold"
                onChange={(e) => setLateEnrollmentDate(e.target.value)}
              />
            </div>

            <div className="space-y-3 max-h-[220px] overflow-y-auto border border-slate-100 rounded-lg p-3 bg-slate-50/50">
              {loadingModalSections ? (
                <div className="flex items-center justify-center py-6 text-base text-slate-400 gap-2 font-extrabold">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading sections...
                </div>
              ) : modalSections.length === 0 ? (
                <p className="text-base text-slate-400 text-center py-4 font-extrabold">
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
                        <span className="text-base font-extrabold text-foreground">
                          Section {s.name}
                        </span>
                      </div>
                      <span className="text-xs font-extrabold text-foreground/80 font-mono">
                        {isFull ? (
                          <span className="text-rose-600 font-extrabold">Full Capacity</span>
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
              className="h-11 font-extrabold bg-white text-slate-700 border-slate-200 hover:bg-slate-50 w-1/2">
              Skip for Now
            </Button>
            <Button
              disabled={submitting || !selectedModalSectionId}
              onClick={handleConfirmSectionAssignment}
              className="h-11 font-extrabold text-white w-1/2 shadow-none border-none"
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
        <DialogContent className="w-full max-w-3xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 bg-amber-50 border-b border-amber-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <DialogTitle className="text-base font-extrabold uppercase text-amber-900">
                Section Capacity Reached
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="px-6 py-5 bg-background space-y-3">
            <p className="text-base leading-tight font-extrabold text-foreground">
              The selected section has reached its maximum DepEd capacity. Are you sure you want to proceed with this assignment?
            </p>
            <p className="text-base text-amber-700 font-extrabold">
              This action will create an over-capacity record. Ensure administrative approval has been obtained.
            </p>
          </div>
          <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border flex items-center justify-end gap-2">
            <Button
              variant="outline"
              className="font-extrabold uppercase text-base"
              onClick={() => {
                setIsCapacityOverrideOpen(false);
                setPendingOverrideContext(null);
              }}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold uppercase text-base px-6 shadow-none border-none"
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
      {/* Duplication Sentinel Blocking Modal */}
      <Dialog open={showDuplicateModal} onOpenChange={setShowDuplicateModal}>
        <DialogContent className="w-full max-w-3xl p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 bg-rose-50 border-b border-rose-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-100 rounded-lg text-rose-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <DialogTitle className="text-base font-extrabold uppercase text-rose-900">
                Duplicate Profile Detected
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="px-6 py-5 bg-background space-y-4 text-left">
            <p className="text-base leading-tight font-extrabold text-foreground">
              A learner profile matching these credentials already exists in the system. Submission is blocked.
            </p>
            {duplicateInfo && (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between text-base font-extrabold">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="text-foreground uppercase">
                    {duplicateInfo.lastName}, {duplicateInfo.firstName}
                  </span>
                </div>
                {duplicateInfo.lrn && (
                  <div className="flex justify-between text-base font-extrabold">
                    <span className="text-muted-foreground">LRN:</span>
                    <span className="text-foreground font-mono">{duplicateInfo.lrn}</span>
                  </div>
                )}
                {duplicateInfo.activeEnrollment ? (
                  <>
                    <div className="flex justify-between text-base font-extrabold">
                      <span className="text-muted-foreground">Tracking Number:</span>
                      <span className="text-foreground font-mono">
                        {duplicateInfo.activeEnrollment.trackingNumber || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between text-base font-extrabold">
                      <span className="text-muted-foreground">Active Section:</span>
                      <span className="text-foreground uppercase">
                        {duplicateInfo.activeEnrollment.sectionName || "Not assigned yet"}
                      </span>
                    </div>
                    <div className="flex justify-between text-base font-extrabold">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant="outline" className="font-extrabold bg-rose-50 border-rose-200 text-rose-800 text-[11px] uppercase">
                        {duplicateInfo.activeEnrollment.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </>
                ) : (
                  <div className="text-base text-amber-700 font-extrabold">
                    No active enrollment application found for the current school year.
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border flex items-center justify-end">
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold uppercase text-base px-6 shadow-none border-none"
              onClick={() => setShowDuplicateModal(false)}
            >
              Close and Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submission Confirmation Modal */}
      <ConfirmationModal
        open={showSubmitConfirmModal}
        onOpenChange={setShowSubmitConfirmModal}
        title="Confirm Submission"
        description="Are you sure you want to save this learner's profile? Please review all details before proceeding."
        confirmText="Save Learner Profile"
        cancelText="Review Details"
        onConfirm={() => {
          setShowSubmitConfirmModal(false);
          void executeSubmit();
        }}
        loading={submitting}
      />
    </div>
  );
}
