import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { sileo } from "sileo";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/shared/lib/zodResolver";
import { z } from "zod";
import {
  Upload,
  Trash2,
  School,
  Check,
  Megaphone,
  BookOpen,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore, type PaletteColor } from "@/store/settings.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { SearchableCombobox } from "@/shared/ui/searchable-combobox";
import { DEPED_TEACHER_PLANTILLA_POSITION_OPTIONS } from "@enrollpro/shared";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Separator } from "@/shared/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";
import { updateIdentitySchema } from "@enrollpro/shared/schemas";

import { Switch } from "@/shared/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import {
  UnsavedChangesBar,
  useUnsavedChanges,
} from "@/shared/hooks/useUnsavedChanges";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "";



export default function SchoolProfileTab() {
  const {
    schoolName,
    logoUrl,
    colorScheme,
    selectedAccentHsl,
    facebookPageUrl,
    depedEmail,
    schoolWebsite,
    depedSchoolId,
    region,
    division,
    schoolHeadName,
    schoolHeadTitle,
    steEnabled,
    spaEnabled,
    spsEnabled,
    globalDefaultPassword,
    setSettings,
    systemStatus,
    viewingSchoolYearStatus,
  } = useSettingsStore();

  const isArchived = systemStatus === "ARCHIVED" || viewingSchoolYearStatus === "ARCHIVED";

  const [uploading, setUploading] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [selectingAccent, setSelectingAccent] = useState(false);
  const [showRemoveLogoConfirm, setShowRemoveLogoConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileFormSchema = updateIdentitySchema.extend({
    steEnabled: z.boolean(),
    spaEnabled: z.boolean(),
    spsEnabled: z.boolean(),
  });

  type FormValues = z.infer<typeof profileFormSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      schoolName: schoolName || "",
      depedSchoolId: depedSchoolId || "",
      region: region || "Region VI - Western Visayas",
      division: division || "Division of Negros Occidental",
      schoolHeadName: schoolHeadName || "",
      schoolHeadTitle: (schoolHeadTitle as FormValues["schoolHeadTitle"]) || "",
      facebookPageUrl: facebookPageUrl || "",
      depedEmail: depedEmail || "",
      schoolWebsite: schoolWebsite || "",
      globalDefaultPassword: globalDefaultPassword || "DepEd2026!",
      steEnabled: steEnabled ?? false,
      spaEnabled: spaEnabled ?? false,
      spsEnabled: spsEnabled ?? false,
    },
  });

  const { isDirty, isSubmitting, dirtyFields } = form.formState;

  const fieldLabels: Record<string, string> = {
    schoolName: "School Name",
    depedSchoolId: "School ID",
    region: "Region",
    division: "Division",
    schoolHeadName: "School Head Name",
    schoolHeadTitle: "Designation",
    facebookPageUrl: "Official Facebook Page URL",
    depedEmail: "Official DepEd Email",
    schoolWebsite: "Official School Website",
    globalDefaultPassword: "Default User Password",
    steEnabled: "STE Program",
    spaEnabled: "SPA Program",
    spsEnabled: "SPS Program",
  };

  const unsavedChangesList = Object.keys(fieldLabels)
    .filter((key) => dirtyFields[key as keyof typeof dirtyFields])
    .map((key) => fieldLabels[key]);

  useEffect(() => {
    form.reset({
      schoolName: schoolName || "",
      depedSchoolId: depedSchoolId || "",
      region: region || "Region VI - Western Visayas",
      division: division || "Division of Negros Occidental",
      schoolHeadName: schoolHeadName || "",
      schoolHeadTitle: (schoolHeadTitle as FormValues["schoolHeadTitle"]) || "",
      facebookPageUrl: facebookPageUrl || "",
      depedEmail: depedEmail || "",
      schoolWebsite: schoolWebsite || "",
      globalDefaultPassword: globalDefaultPassword || "DepEd2026!",
      steEnabled: steEnabled ?? false,
      spaEnabled: spaEnabled ?? false,
      spsEnabled: spsEnabled ?? false,
    });
  }, [
    schoolName,
    depedSchoolId,
    region,
    division,
    schoolHeadName,
    schoolHeadTitle,
    facebookPageUrl,
    depedEmail,
    schoolWebsite,
    globalDefaultPassword,
    steEnabled,
    spaEnabled,
    spsEnabled,
    form.reset,
  ]);

  const palette: PaletteColor[] =
    (colorScheme as { palette?: PaletteColor[] } | null)?.palette ?? [];
  const currentAccent = selectedAccentHsl ?? "221 83% 53%";

  const onSubmit = useCallback(async (values: FormValues) => {
    try {
      const identityPayload = {
        schoolName: values.schoolName?.toUpperCase() || "",
        depedSchoolId: values.depedSchoolId || "",
        region: values.region?.toUpperCase() || "",
        division: values.division?.toUpperCase() || "",
        schoolHeadName: values.schoolHeadName?.toUpperCase() || "",
        schoolHeadTitle: values.schoolHeadTitle || "",
        facebookPageUrl: values.facebookPageUrl || "",
        depedEmail: values.depedEmail || "",
        schoolWebsite: values.schoolWebsite || "",
        globalDefaultPassword: values.globalDefaultPassword || "",
      };

      const programsPayload = {
        steEnabled: values.steEnabled,
        spaEnabled: values.spaEnabled,
        spsEnabled: values.spsEnabled,
      };

      await Promise.all([
        api.put("/settings/identity", identityPayload),
        api.patch("/settings/programs", programsPayload)
      ]);

      setSettings({
        ...identityPayload,
        ...programsPayload,
      });
      form.reset(values);
      sileo.success({
        title: "Settings Saved",
        description: "School profile and programs updated successfully.",
      });
    } catch (err) {
      toastApiError(err as never);
    }
  }, [form, setSettings]);

  const handleDiscard = useCallback(() => {
    form.reset();
  }, [form]);

  const handleSaveConfiguration = useMemo(
    () => form.handleSubmit(onSubmit),
    [form, onSubmit],
  );

  useUnsavedChanges({
    id: "settings-school-profile",
    label: "School profile",
    isDirty: !isArchived && isDirty,
    isSubmitting,
    onDiscard: handleDiscard,
    onSave: handleSaveConfiguration,
    saveLabel: "Save Configuration",
    showStickyBar: true,
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      sileo.error({
        title: "File too large",
        description: "Maximum file size is 2MB.",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await api.post("/settings/logo", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSettings({
        logoUrl: res.data.logoUrl,
        colorScheme: res.data.colorScheme,
        selectedAccentHsl: res.data.selectedAccentHsl ?? null,
      });
      setLogoPreview(null);
      setTimeout(() => {
        sileo.success({
          title: "Logo Uploaded",
          description: "Palette extracted from your logo.",
        });
      }, 50);
    } catch (err) {
      setLogoPreview(null);
      toastApiError(err as never);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = async () => {
    setRemovingLogo(true);
    try {
      await api.delete("/settings/logo");
      setSettings({
        logoUrl: null,
        colorScheme: null,
        selectedAccentHsl: null,
      });
      setLogoPreview(null);
      setTimeout(() => {
        sileo.success({
          title: "Logo Removed",
          description: "Default blue accent restored.",
        });
      }, 50);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setRemovingLogo(false);
      setShowRemoveLogoConfirm(false);
    }
  };

  const handleSelectAccent = async (color: PaletteColor) => {
    setSelectingAccent(true);
    try {
      const res = await api.put("/settings/accent", { hsl: color.hsl });
      setSettings({
        selectedAccentHsl: res.data.selectedAccentHsl,
        colorScheme: res.data.colorScheme,
      });
      setTimeout(() => {
        sileo.success({
          title: "Accent Updated",
          description: "Your accent color has been changed.",
        });
      }, 50);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSelectingAccent(false);
    }
  };

  const handleToggleProgram = (key: "steEnabled" | "spaEnabled" | "spsEnabled", value: boolean) => {
    form.setValue(key, value, { shouldDirty: true, shouldValidate: true });
  };
  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <fieldset disabled={isArchived} className="space-y-8 group min-w-0">
            {/* Institutional Identity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <div className="h-10 w-10 shrink-0 bg-primary/10 text-primary rounded-lg flex items-center justify-center shadow-sm border border-primary/20">
                    <School className="h-5 w-5" />
                  </div>
                  <span className="break-words min-w-0">School Identity</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="schoolName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>School Name</FormLabel>
                        <FormControl>
                          <Input className="font-bold uppercase" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="depedSchoolId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>School ID (6-digit format)</FormLabel>
                        <FormControl>
                          <Input className="font-bold uppercase" placeholder="e.g. 123456" {...field} value={field.value ?? ""} maxLength={6} inputMode="numeric" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="region"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Region</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Region VI - Western Visayas" {...field} value={field.value ?? ""} readOnly className="text-foreground cursor-not-allowed border-transparent font-bold uppercase" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="division"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Division</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Division of Negros Occidental" {...field} value={field.value ?? ""} readOnly className="text-foreground cursor-not-allowed border-transparent font-bold uppercase" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="schoolHeadName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>School Head Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Juan Dela Cruz" {...field} value={field.value ?? ""} className="font-bold uppercase" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="schoolHeadTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Designation</FormLabel>
                        <FormControl>
                          <SearchableCombobox
                            items={[
                              { value: "", label: "No designation" },
                              ...DEPED_TEACHER_PLANTILLA_POSITION_OPTIONS
                            ]}
                            value={field.value || ""}
                            onChange={(val) => field.onChange(val)}
                            disabled={isArchived}
                            placeholder="Select designation"
                            searchPlaceholder="Search designation..."
                            className="font-bold"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Active Academic Programs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <div className="h-10 w-10 shrink-0 bg-primary/10 text-primary rounded-lg flex items-center justify-center shadow-sm border border-primary/20">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <span className="break-words min-w-0">Active Special Curricular Programs (SCP)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                  <div className="flex flex-col justify-center gap-2 rounded-lg border p-4 shadow-sm min-h-[4.5rem]">
                    <div className="flex items-center justify-between">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <FormLabel className="text-xl cursor-help font-extrabold">STE</FormLabel>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-sm font-bold">Science, Technology, and Engineering</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Switch
                        checked={form.watch("steEnabled")}
                        onCheckedChange={(checked) => handleToggleProgram("steEnabled", checked)}
                        disabled={isArchived || isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col justify-center gap-2 rounded-lg border p-4 shadow-sm min-h-[4.5rem]">
                    <div className="flex items-center justify-between">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <FormLabel className="text-xl cursor-help font-extrabold">SPA</FormLabel>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-sm font-bold">Special Program in the Arts</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Switch
                        checked={form.watch("spaEnabled")}
                        onCheckedChange={(checked) => handleToggleProgram("spaEnabled", checked)}
                        disabled={isArchived || isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col justify-center gap-2 rounded-lg border p-4 shadow-sm min-h-[4.5rem]">
                    <div className="flex items-center justify-between">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <FormLabel className="text-xl cursor-help font-extrabold">SPS</FormLabel>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-sm font-bold">Special Program in Sports</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Switch
                        checked={form.watch("spsEnabled")}
                        onCheckedChange={(checked) => handleToggleProgram("spsEnabled", checked)}
                        disabled={isArchived || isSubmitting}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>


            {/* Channels & Branding */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <div className="h-10 w-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center shadow-sm border border-primary/20">
                    <Megaphone className="h-5 w-5" />
                  </div>
                  Official Communication Channels & Branding
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="facebookPageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Facebook Page URL</FormLabel>
                        <FormControl>
                          <Input className="font-bold" placeholder="https://www.facebook.com/..." {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="depedEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Official DepEd Email</FormLabel>
                        <FormControl>
                          <Input
                            className="font-bold"
                            placeholder="school.id@deped.edu.ph"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => {
                              const input = e.target;
                              const val = input.value;

                              // If field was empty and user types one char (not '@')
                              if (val.length === 1 && !field.value && val !== "@") {
                                field.onChange(val + "@deped.edu.ph");
                                // Wait a tick for React state to update the input value, then move cursor
                                requestAnimationFrame(() => {
                                  input.setSelectionRange(1, 1);
                                });
                              } else {
                                field.onChange(e);
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="schoolWebsite"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>School Website (Optional)</FormLabel>
                        <FormControl>
                          <Input className="font-bold" placeholder="https://your-school.edu.ph" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
                  {/* Logo preview & upload */}
                  <div className="space-y-3">
                    <h4 className="text-base leading-tight font-extrabold">Official School Logo</h4>
                    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-border bg">
                        {logoPreview ? (
                          <img
                            src={logoPreview}
                            alt="Preview"
                            className="h-full w-full rounded-lg object-contain p-1"
                          />
                        ) : logoUrl ? (
                          <img
                            src={`${API_BASE}${logoUrl}`}
                            alt="School Logo"
                            className="h-full w-full rounded-lg object-contain p-1"
                          />
                        ) : (
                          <Upload className="h-8 w-8 text-foreground" />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-3">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".png,.jpg,.jpeg,.webp"
                          onChange={handleLogoUpload}
                          className="hidden"
                          id="logo-upload"
                        />
                        <div className="flex flex-wrap gap-2 mt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isArchived || uploading}
                            className="text-primary">
                            <Upload className="mr-2 h-4 w-4" />
                            {uploading ? "Uploading..." : "Upload Logo"}
                          </Button>
                          {logoUrl && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setShowRemoveLogoConfirm(true)}
                              disabled={isArchived || removingLogo}
                              className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              {removingLogo ? "Removing..." : "Remove"}
                            </Button>
                          )}
                        </div>
                        <p className="text-base leading-tight">Accepted: .png, .jpg, .webp — Max 2MB</p>
                      </div>
                    </div>
                  </div>

                  {/* Extracted Palette */}
                  {palette.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-base leading-tight font-extrabold">Official School Color</h4>
                      <p className="text-sm leading-tight">
                        Select a color from your uploaded logo to apply to the system's buttons and menus.
                      </p>
                      <div className="flex flex-row flex-wrap items-start gap-6">
                        {palette.map((color, i) => {
                          const isSelected = color.hsl === currentAccent;
                          return (
                            <div
                              key={i}
                              className="flex flex-col items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSelectAccent(color)}
                                disabled={isArchived || selectingAccent}
                                className={`group relative h-16 w-16 rounded-2xl border-2 transition-all hover:scale-105 ${isSelected
                                  ? "ring-4 ring-primary shadow-sm"
                                  : "border-border/50 hover:border-foreground/50 hover:shadow-md shadow-sm"
                                  }`}
                                style={{ backgroundColor: color.hex }}
                                title={`${color.hex} — hsl(${color.hsl})`}>
                                {isSelected && (
                                  <Check
                                    className="absolute inset-0 m-auto h-6 w-6 drop-shadow-md"
                                    style={{ color: `hsl(${color.foreground})` }}
                                  />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Global Sticky Footer */}
            {!isArchived && isDirty && (
              <UnsavedChangesBar
                isSubmitting={isSubmitting}
                onDiscard={handleDiscard}
                onSave={handleSaveConfiguration}
                saveLabel="Save Configuration"
                changesList={unsavedChangesList}
              />
            )}
          </fieldset>
        </form>
      </Form>
      <ConfirmationModal
        open={showRemoveLogoConfirm}
        onOpenChange={setShowRemoveLogoConfirm}
        title="Remove School Logo"
        description="Are you sure you want to remove the official school logo? This will revert the system to the default blue theme."
        confirmText="Remove Logo"
        onConfirm={handleRemoveLogo}
        variant="danger"
        loading={removingLogo}
      />
    </div>
  );
}
