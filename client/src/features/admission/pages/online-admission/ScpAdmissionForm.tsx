import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@/shared/lib/zodResolver";
import { scpAdmissionSubmitSchema } from "@enrollpro/shared/schemas";
import type { ApplicationSubmitResponse } from "@enrollpro/shared";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/shared/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { ArrowLeft, Camera, Info, Mars, Search, Venus, X } from "lucide-react";
import { PhilippineAddressSelector } from "@/shared/components/PhilippineAddressSelector";
import { HybridDatePicker } from "@/shared/components/HybridDatePicker";
import { UserPhoto } from "@/shared/components/UserPhoto";
import api from "@/shared/api/axiosInstance";
import { cn } from "@/shared/lib/utils";
import type { z } from "zod";
import { differenceInYears } from "date-fns";

type ScpFormData = z.infer<typeof scpAdmissionSubmitSchema>;

interface Props {
  intakeChoice: "NEW" | "RETURNING";
  onSuccess: (data: ApplicationSubmitResponse) => void;
  onCancel: () => void;
}

export default function ScpAdmissionForm({ intakeChoice, onSuccess, onCancel }: Props) {
  const form = useForm<ScpFormData>({
    resolver: zodResolver(scpAdmissionSubmitSchema),
    mode: "onChange",
    defaultValues: {
      isScpApplication: true,
      scpType: undefined,
      isPrivacyConsentGiven: false,
      learnerType: intakeChoice === "RETURNING" ? "RETURNING" : "NEW_ENROLLEE",
      gradeLevel: "7",
      studentPhoto: null,
      hasNoLrn: false,
      lrn: "",
      lastName: "",
      firstName: "",
      middleName: "",
      extensionName: "",
      birthdate: "",
      sex: "MALE",
      placeOfBirth: "",
      religion: "",
      motherTongue: "",
      isIpCommunity: false,
      ipGroupName: "",
      is4PsBeneficiary: false,
      householdId4Ps: "",
      isLearnerWithDisability: false,
      specialNeedsCategory: undefined,
      hasPwdId: false,
      disabilityTypes: [],
      currentAddress: { houseNoStreet: "", sitio: "", barangay: "", cityMunicipality: "", province: "", region: "" },
      permanentAddress: { houseNoStreet: "", sitio: "", barangay: "", cityMunicipality: "", province: "", region: "" },
      mother: { lastName: "", firstName: "", middleName: "", contactNumber: "", email: "", occupation: "" },
      father: { lastName: "", firstName: "", middleName: "", contactNumber: "", email: "", occupation: "" },
      lastSchoolName: "",
      lastSchoolId: "",
      lastGradeCompleted: "6",
      schoolYearLastAttended: "2025-2026",
      lastSchoolAddress: "",
      transferCertificateNo: "",
      lastSchoolType: "PUBLIC",
      grade5GeneralAverage: undefined,
      underSpecialScienceCurriculum: false,
      artsSpecialization: null,
      chosenSport: "",
    },
  });

  const { control, handleSubmit, setValue } = form;
  const selectedScp = useWatch({ control, name: "scpType" });
  const birthdateStr = useWatch({ control, name: "birthdate" });
  const studentPhoto = useWatch({ control, name: "studentPhoto" });
  const hasNoLrn = useWatch({ control, name: "hasNoLrn" });
  const grade5GeneralAverage = useWatch({ control, name: "grade5GeneralAverage" });
  const artsSpecialization = useWatch({ control, name: "artsSpecialization" });
  const chosenSport = useWatch({ control, name: "chosenSport" });
  const { isSubmitting, isValid } = form.formState;

  const isDynamicProfileComplete =
    selectedScp === "SCIENCE_TECHNOLOGY_AND_ENGINEERING"
      ? grade5GeneralAverage !== undefined
      : selectedScp === "SPECIAL_PROGRAM_IN_THE_ARTS"
        ? grade5GeneralAverage !== undefined && Boolean(artsSpecialization)
        : selectedScp === "SPECIAL_PROGRAM_IN_SPORTS"
          ? grade5GeneralAverage !== undefined && Boolean(chosenSport?.trim())
          : false;

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
      alert("Only JPG and PNG files are accepted");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setValue("studentPhoto", reader.result as string, { shouldDirty: true });
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (selectedScp !== "SCIENCE_TECHNOLOGY_AND_ENGINEERING") {
      setValue("underSpecialScienceCurriculum", false, { shouldValidate: true });
    }
    if (selectedScp !== "SPECIAL_PROGRAM_IN_THE_ARTS") {
      setValue("artsSpecialization", null, { shouldValidate: true });
    }
    if (selectedScp !== "SPECIAL_PROGRAM_IN_SPORTS") {
      setValue("chosenSport", "", { shouldValidate: true });
    }
  }, [selectedScp, setValue]);

  const onSubmit = async (data: ScpFormData) => {
    try {
      const response = await api.post("/admission", data);
      onSuccess(response.data);
    } catch (error) {
      console.error(error);
      alert("Submission failed. Please check the fields and try again.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-0">
      <Button
        type="button"
        onClick={onCancel}
        className="mb-6 group font-bold uppercase bg-primary text-white hover:bg-primary/90 shadow-md transition-all px-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Back to Privacy Notice
      </Button>

      <Card className="shadow-sm border-border rounded-2xl overflow-hidden mb-12">
        <CardContent className="p-6 md:p-10">
          <div className="mb-8 pb-6 border-b border-border/50">
            <h2 className="text-xl font-bold text-foreground leading-tight">
              Learner Admission Form
            </h2>
            <p className="text-base leading-tight text-foreground mt-0.5">
              Please complete all required fields below.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-16">
              <div className="space-y-8">
                <div className="flex items-center gap-2 border-b pb-2">
                  <h3 className="text-lg font-bold uppercase text-primary">
                    I. Special Curricular Program
                  </h3>
                </div>
                <div className="space-y-4 rounded-2xl border border-border p-6">
              <FormField
                control={control}
                name="scpType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base leading-tight font-bold">Select Special Curricular Program <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger className="h-11 font-bold uppercase">
                          <SelectValue placeholder="SELECT SPECIAL CURRICULAR PROGRAM" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="SCIENCE_TECHNOLOGY_AND_ENGINEERING">Science, Technology, and Engineering (STE)</SelectItem>
                        <SelectItem value="SPECIAL_PROGRAM_IN_THE_ARTS">Special Program in the Arts (SPA)</SelectItem>
                        <SelectItem value="SPECIAL_PROGRAM_IN_SPORTS">Special Program in Sports (SPS)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {selectedScp && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    {selectedScp === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" &&
                      "Eligibility: No grades lower than 85% in Math and Science, and 80% in other subjects. Must pass the written exam and interview."}
                    {selectedScp === "SPECIAL_PROGRAM_IN_THE_ARTS" &&
                      "Eligibility: Must undergo screening, audition, and interview for the chosen arts discipline."}
                    {selectedScp === "SPECIAL_PROGRAM_IN_SPORTS" &&
                      "Eligibility: General Average of 80 and above with NO failing grades per subject. Must pass physical fitness and skills tests."}
                  </AlertDescription>
                </Alert>
              )}
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-2 border-b pb-2">
                  <h3 className="text-lg font-bold uppercase text-primary">
                    II. Personal Information
                  </h3>
                </div>
                <div className="space-y-8">
                  <div className="p-6 border rounded-2xl space-y-4 bg-muted/20 border-border">
                    <div>
                      <h4 className="text-base leading-tight font-bold uppercase text-foreground">
                        Learner Reference Number (LRN)
                      </h4>
                      <p className="text-base text-foreground">
                        Enter learner's 12-digit LRN to continue admission.
                      </p>
                    </div>
                    <FormField control={control} name="lrn" render={({ field }) => (
                      <FormItem>
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ""}
                              disabled={hasNoLrn}
                              autoComplete="off"
                              inputMode="numeric"
                              maxLength={12}
                              placeholder="ENTER 12-DIGIT LRN"
                              className="h-14 border-2 border-primary/30 pl-12 text-center text-lg font-bold tracking-widest focus:border-primary"
                              onInput={(event) => {
                                event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "");
                              }}
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <p className="text-base text-foreground">
                      Provide the LRN, or declare below that the incoming Grade 7 learner has no LRN yet.
                    </p>
                    <FormField control={control} name="hasNoLrn" render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            id="admission-has-no-lrn"
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked === true);
                              if (checked === true) setValue("lrn", "", { shouldValidate: true });
                            }}
                          />
                        </FormControl>
                        <Label htmlFor="admission-has-no-lrn" className="cursor-pointer text-base font-bold">
                          Learner has no LRN yet.
                        </Label>
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
                    <div className="md:col-span-1 flex flex-col items-center justify-center space-y-3">
                      <Label className="text-base leading-tight font-bold self-start md:self-center">
                        Learner's Photo
                      </Label>
                      <div className="relative group">
                        <UserPhoto
                          photo={studentPhoto}
                          containerClassName={cn(
                            "w-32 h-32 rounded-lg border-2 border-dashed transition-all duration-200",
                            studentPhoto
                              ? "border-primary/50 bg-background"
                              : "border-muted-foreground/30 bg-muted/50 hover:border-primary/50 hover:bg-muted/80",
                          )}
                          fallbackIcon={
                            <div className="flex flex-col items-center text-foreground group-hover:text-primary transition-colors">
                              <Camera className="w-8 h-8 mb-1" />
                              <span className="text-[0.625rem] uppercase font-bold">
                                Upload Photo
                              </span>
                            </div>
                          }
                        >
                          {studentPhoto && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setValue("studentPhoto", null, { shouldDirty: true });
                              }}
                              className="absolute top-1 right-1 p-1 bg-primary text-primary-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-20"
                              aria-label="Remove learner photo"
                            >
                              <X strokeWidth={3} className="w-3 h-3" />
                            </button>
                          )}
                        </UserPhoto>
                        <input
                          type="file"
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          accept="image/jpeg,image/png,image/jpg"
                          onChange={handlePhotoChange}
                          title="Upload learner's photo"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={control} name="lastName" render={({field}) => (
                      <FormItem>
                        <FormLabel className="text-base leading-tight font-bold">Last Name <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input {...field} autoComplete="off" placeholder="e.g. DELA CRUZ" className="h-11 uppercase font-bold" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={control} name="firstName" render={({field}) => (
                      <FormItem>
                        <FormLabel className="text-base leading-tight font-bold">First Name <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input {...field} autoComplete="off" placeholder="e.g. JUAN" className="h-11 uppercase font-bold" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={control} name="middleName" render={({field}) => (
                      <FormItem>
                        <FormLabel className="text-base leading-tight font-bold">Middle Name</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} autoComplete="off" placeholder="e.g. BAUTISTA" className="h-11 uppercase font-bold" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={control} name="extensionName" render={({field}) => (
                      <FormItem>
                        <FormLabel className="text-base leading-tight font-bold">Suffix (Extension)</FormLabel>
                        <Select onValueChange={(value) => field.onChange(value === "NONE" ? "" : value)} value={field.value || "NONE"}>
                          <FormControl><SelectTrigger className="h-11 font-bold"><SelectValue placeholder="Select Suffix" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="NONE">None</SelectItem>
                            {["Jr.", "Sr.", "II", "III", "IV", "V"].map((suffix) => <SelectItem key={suffix} value={suffix}>{suffix}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                    <FormField control={control} name="birthdate" render={({field}) => (
                      <FormItem>
                        <FormLabel className="text-base leading-tight font-bold">Date of Birth <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <HybridDatePicker
                            value={field.value instanceof Date ? field.value.toISOString().split("T")[0] : field.value}
                            onChange={field.onChange}
                            placeholder="MM/DD/YYYY"
                            className="h-11 font-bold"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormItem>
                      <FormLabel className="text-base leading-tight font-bold">Age</FormLabel>
                      <FormControl>
                        <Input readOnly disabled placeholder="Auto-calculated" className="h-11 font-bold cursor-not-allowed disabled:opacity-100 disabled:bg-muted" value={birthdateStr ? differenceInYears(new Date(new Date().getFullYear(), 5, 30), new Date(birthdateStr)) : ""} />
                      </FormControl>
                    </FormItem>
                    <FormField control={control} name="sex" render={({field}) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-base leading-tight font-bold">Sex <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <div className="flex gap-4 pt-1">
                            {[
                              { value: "MALE" as const, label: "MALE", icon: Mars },
                              { value: "FEMALE" as const, label: "FEMALE", icon: Venus },
                            ].map((option) => (
                              <button key={option.value} type="button" onClick={() => field.onChange(option.value)} className={cn("flex items-center gap-2 rounded-lg border-2 px-4 py-2 transition-colors text-base uppercase", field.value === option.value ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted/50 text-foreground")}>
                                <option.icon className="w-4 h-4" />
                                <span className="font-bold">{option.label}</span>
                              </button>
                            ))}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={control} name="placeOfBirth" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base leading-tight font-bold">Place of Birth <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input {...field} autoComplete="off" placeholder="CITY/MUNICIPALITY, PROVINCE" className="h-11 uppercase font-bold" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={control} name="motherTongue" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base leading-tight font-bold">Mother Tongue <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input {...field} autoComplete="off" placeholder="e.g. HILIGAYNON" className="h-11 uppercase font-bold" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  
                  <div className="space-y-4 pt-6 border-t">
                    <h4 className="text-base leading-tight font-bold uppercase text-foreground">Complete Home/Permanent Address</h4>
                    <FormField control={control} name="currentAddress" render={({field}) => (
                      <FormItem>
                        <FormControl>
                          <div className="space-y-4">
                            <PhilippineAddressSelector
                              value={{
                                barangay: field.value?.barangay,
                                cityMunicipality: field.value?.cityMunicipality,
                                province: field.value?.province,
                                region: field.value?.region,
                              }}
                              onChange={(addressField, addressValue) => {
                                field.onChange({
                                  houseNoStreet: field.value?.houseNoStreet || "",
                                  sitio: field.value?.sitio || "",
                                  barangay: field.value?.barangay || "",
                                  cityMunicipality: field.value?.cityMunicipality || "",
                                  province: field.value?.province || "",
                                  region: field.value?.region || "",
                                  [addressField]: addressValue,
                                });
                              }}
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <Input 
                                placeholder="HOUSE NO. / STREET" 
                                className="h-11 uppercase font-bold"
                                value={field.value?.houseNoStreet || ""} 
                                onChange={(e) => field.onChange({...field.value, houseNoStreet: e.target.value})} 
                              />
                              <Input 
                                placeholder="SITIO / PUROK (OPTIONAL)" 
                                className="h-11 uppercase font-bold"
                                value={field.value?.sitio || ""} 
                                onChange={(e) => field.onChange({...field.value, sitio: e.target.value})} 
                              />
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-2 border-b pb-2">
                  <h3 className="text-lg font-bold uppercase text-primary">
                    III. Previous School Information
                  </h3>
                </div>
                <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={control} name="lastSchoolName" render={({field}) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-base leading-tight font-bold text-foreground">Last School Name <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input {...field} autoComplete="off" placeholder="e.g. APOLINARIO MABINI ELEMENTARY SCHOOL" className="h-11 uppercase font-bold" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={control} name="lastSchoolId" render={({field}) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-base leading-tight font-bold text-foreground">School ID (Optional)</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} autoComplete="off" placeholder="6-DIGIT DEPED ID" maxLength={6} inputMode="numeric" className="h-11 uppercase font-bold" onInput={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/\D/g, ""); }} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={control} name="lastSchoolAddress" render={({field}) => (
                  <FormItem className="md:col-span-2 space-y-2">
                    <FormLabel className="text-base leading-tight font-bold text-foreground">School Address / Division (Optional)</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} autoComplete="off" placeholder="CITY/MUNICIPALITY, PROVINCE" className="h-11 uppercase font-bold" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={control} name="lastSchoolType" render={({field}) => (
                  <FormItem className="md:col-span-2 space-y-3">
                    <FormLabel className="text-base leading-tight font-bold text-foreground">School Type <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { value: "PUBLIC" as const, label: "Public" },
                          { value: "PRIVATE" as const, label: "Private" },
                          { value: "INTERNATIONAL" as const, label: "International" },
                          { value: "ALS" as const, label: "ALS" },
                        ].map((option) => (
                          <button key={option.value} type="button" onClick={() => field.onChange(option.value)} className={cn("flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-11 uppercase", field.value === option.value ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-muted hover:bg-primary/5 text-foreground")}>
                            <span className="font-bold text-base leading-tight">{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-2 border-b pb-2">
                  <h3 className="text-lg font-bold uppercase text-primary">
                    IV. Academic Profile &amp; Qualifications
                  </h3>
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={control} name="grade5GeneralAverage" render={({field}) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-base leading-tight font-bold">Grade 5 Final General Average <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input {...field} type="number" step="0.01" placeholder="e.g. 90.00" className="h-11 font-bold" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.valueAsNumber || undefined)} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    {selectedScp === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" && (
                      <FormField control={control} name="underSpecialScienceCurriculum" render={({field}) => (
                        <FormItem className="space-y-3">
                          <FormLabel className="text-base leading-tight font-bold">Under Special Science Curriculum in Elementary?</FormLabel>
                          <FormControl>
                            <div className="grid grid-cols-2 gap-3">
                              {[{ value: true, label: "Yes" }, { value: false, label: "No" }].map((option) => (
                                <button key={String(option.value)} type="button" onClick={() => field.onChange(option.value)} className={cn("flex items-center justify-center p-3 rounded-xl border-2 transition-all text-center h-11 uppercase", field.value === option.value ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-muted hover:bg-primary/5 text-foreground")}>
                                  <span className="font-bold text-base leading-tight">{option.label}</span>
                                </button>
                              ))}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}

                    {selectedScp === "SPECIAL_PROGRAM_IN_THE_ARTS" && (
                      <FormField control={control} name="artsSpecialization" render={({field}) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-base leading-tight font-bold">Arts Specialization <span className="text-destructive">*</span></FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl><SelectTrigger className="h-11 font-bold uppercase"><SelectValue placeholder="SELECT ARTS SPECIALIZATION" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="CREATIVE_WRITING">Creative Writing</SelectItem>
                              <SelectItem value="MEDIA_AND_VISUAL_ARTS">Media &amp; Visual Arts</SelectItem>
                              <SelectItem value="MUSIC">Music</SelectItem>
                              <SelectItem value="DANCE">Dance</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}

                    {selectedScp === "SPECIAL_PROGRAM_IN_SPORTS" && (
                      <FormField control={control} name="chosenSport" render={({field}) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-base leading-tight font-bold">Chosen Sport <span className="text-destructive">*</span></FormLabel>
                          <FormControl><Input {...field} value={field.value || ""} placeholder="e.g. VOLLEYBALL" className="h-11 uppercase font-bold" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                  </div>
                </div>
              </div>
          
              <div className="pt-8 border-t border-border/60 space-y-6">
                <div className="p-6 bg-primary/5 border border-primary/10 rounded-2xl space-y-4">
                  <h3 className="text-lg leading-tight font-extrabold uppercase text-primary">
                    Accuracy Certification
                  </h3>
            <FormField
              control={control}
              name="isPrivacyConsentGiven"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="font-bold">
                      I hereby certify that the information provided is true and correct to the best of my knowledge and belief. I understand that any false statement may result in the rejection of my application.
                    </FormLabel>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
                </div>

                <div className="flex justify-end">
              <Button type="submit" size="lg" disabled={isSubmitting || !isValid || !isDynamicProfileComplete} className="w-full sm:w-auto px-8 font-bold">
                Submit Admission Application
              </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
