export interface ApplicationAddress {
  houseNo?: string;
  street?: string;
  sitio?: string;
  barangay: string;
  cityMunicipality: string;
  province: string;
  country: string;
  zipCode?: string;
}

export interface ApplicantDetail {
  birthDate: string;
  currentAddress: ApplicationAddress | null;
  disabilityTypes: string[];
  firstName: string;
  generalAverage: number | null;
  householdId4Ps: string | null;
  ipGroupName: string | null;
  is4PsBeneficiary: boolean;
  isBalikAral: boolean;
  isIpCommunity: boolean;
  isLearnerWithDisability: boolean;
  lastGradeCompleted: string | null;
  lastName: string;
  lastSchoolAddress: string | null;
  lastSchoolId: string | null;
  lastSchoolName: string | null;
  lastSchoolType: string | null;
  lastYearEnrolled: string | null;
  learnerType: string;
  middleName: string | null;
  motherTongue: string | null;
  placeOfBirth: string | null;
  religion: string | null;
  schoolYearLastAttended: string | null;
  sex: string;
  suffix: string | null;
}
