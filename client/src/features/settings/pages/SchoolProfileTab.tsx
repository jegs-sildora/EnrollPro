import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { sileo } from "sileo";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  UnsavedChangesBar,
  useUnsavedChanges,
} from "@/shared/hooks/useUnsavedChanges";

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
  const [togglingProgram, setTogglingProgram] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  type FormValues = z.infer<typeof updateIdentitySchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(updateIdentitySchema),
    defaultValues: {
      schoolName: schoolName || "",
      depedSchoolId: depedSchoolId || "",
      region: region || "Region VI - Western Visayas",
      division: division || "Division of Negros Occidental",
      schoolHeadName: schoolHeadName || "",
      schoolHeadTitle: schoolHeadTitle || "",
      facebookPageUrl: facebookPageUrl || "",
      depedEmail: depedEmail || "",
      schoolWebsite: schoolWebsite || "",
      globalDefaultPassword: globalDefaultPassword || "DepEd2026!",
    },
  });

  const { isDirty, isSubmitting } = form.formState;

  useEffect(() => {
    form.reset({
      schoolName: schoolName || "",
      depedSchoolId: depedSchoolId || "",
      region: region || "Region VI - Western Visayas",
      division: division || "Division of Negros Occidental",
      schoolHeadName: schoolHeadName || "",
      schoolHeadTitle: schoolHeadTitle || "",
      facebookPageUrl: facebookPageUrl || "",
      depedEmail: depedEmail || "",
      schoolWebsite: schoolWebsite || "",
      globalDefaultPassword: globalDefaultPassword || "DepEd2026!",
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
    form.reset,
  ]);

  const palette: PaletteColor[] =
    (colorScheme as { palette?: PaletteColor[] } | null)?.palette ?? [];
  const currentAccent =
    selectedAccentHsl ??
    (colorScheme as { accent_hsl?: string } | null)?.accent_hsl ??
    "221 83% 53%";

  const onSubmit = useCallback(async (values: FormValues) => {
    try {
      await api.put("/settings/identity", values);
      setSettings(values);
      form.reset(values);
      sileo.success({
        title: "Settings Saved",
        description: "School identity and channels updated successfully.",
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

  const handleToggleProgram = async (key: "steEnabled" | "spaEnabled" | "spsEnabled", value: boolean) => {
    setTogglingProgram(true);
    try {
      const payload = {
        steEnabled,
        spaEnabled,
        spsEnabled,
        [key]: value,
      };
      const res = await api.patch("/settings/programs", payload);
      setSettings({
        steEnabled: res.data.steEnabled,
        spaEnabled: res.data.spaEnabled,
        spsEnabled: res.data.spsEnabled,
      });
      sileo.success({
        title: "Programs Updated",
        description: "Active academic programs saved.",
      });
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setTogglingProgram(false);
    }
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
                          <Input className="font-bold" {...field} />
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
                          <Input className="font-bold" placeholder="e.g. 123456" {...field} value={field.value ?? ""} maxLength={6} inputMode="numeric" />
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
                          <Input placeholder="e.g. Region VI - Western Visayas" {...field} value={field.value ?? ""} readOnly className="text-foreground cursor-not-allowed border-transparent font-bold" />
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
                          <Input placeholder="e.g. Division of Negros Occidental" {...field} value={field.value ?? ""} readOnly className="text-foreground cursor-not-allowed border-transparent font-bold" />
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
                          <Input placeholder="e.g. Juan Dela Cruz" {...field} value={field.value ?? ""} className="font-bold" />
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
                          <Input placeholder="e.g. Principal IV" {...field} value={field.value ?? ""} className="font-bold" />
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
                  <span className="break-words min-w-0">Active Academic Programs</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
                  <div className="flex flex-col gap-2 rounded-lg border p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">STE</FormLabel>
                        <p className="text-base leading-tight text-foreground">Science, Technology, and Engineering</p>
                      </div>
                      <Switch
                        checked={steEnabled}
                        onCheckedChange={(checked) => handleToggleProgram("steEnabled", checked)}
                        disabled={isArchived || togglingProgram}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 rounded-lg border p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">SPA</FormLabel>
                        <p className="text-base leading-tight text-foreground">Special Program in the Arts</p>
                      </div>
                      <Switch
                        checked={spaEnabled}
                        onCheckedChange={(checked) => handleToggleProgram("spaEnabled", checked)}
                        disabled={isArchived || togglingProgram}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 rounded-lg border p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">SPS</FormLabel>
                        <p className="text-base leading-tight text-foreground">Special Program in Sports</p>
                      </div>
                      <Switch
                        checked={spsEnabled}
                        onCheckedChange={(checked) => handleToggleProgram("spsEnabled", checked)}
                        disabled={isArchived || togglingProgram}
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
                          <Input className="font-bold" placeholder="school.id@deped.edu.ph" {...field} value={field.value ?? ""} />
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
                            disabled={isArchived || uploading}>
                            <Upload className="mr-2 h-4 w-4" />
                            {uploading ? "Uploading..." : "Upload Logo"}
                          </Button>
                          {logoUrl && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleRemoveLogo}
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
                    <div className="space-y-3">
                      <h4 className="text-base leading-tight font-extrabold">Official School Color</h4>
                      <p className="text-base leading-tight">
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
                                  ? "border-foreground ring-4 ring-foreground/20 ring-offset-2 shadow-sm"
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
              />
            )}
          </fieldset>
        </form>
      </Form>
    </div>
  );
}
