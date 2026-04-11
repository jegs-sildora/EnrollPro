import { useState, useRef, useEffect } from "react";
import { sileo } from "sileo";
import { Upload, Trash2, School, Palette, Check } from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore, type PaletteColor } from "@/store/settings.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Separator } from "@/shared/ui/separator";

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "";

/** Returns true if the HSL accent color is light (needs dark text) */
function isAccentLight(hsl: string): boolean {
  const parts = hsl.split(/\s+/);
  const h = parseInt(parts[0]) || 0;
  let s = parseInt(parts[1]) || 0;
  let l = parseInt(parts[2]) || 0;
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const lum =
    0.2126 * toLinear(f(0)) + 0.7152 * toLinear(f(8)) + 0.0722 * toLinear(f(4));
  const contrastWhite = 1.05 / (lum + 0.05);
  const contrastBlack = (lum + 0.05) / 0.05;
  return contrastBlack >= contrastWhite;
}

export default function SchoolProfileTab() {
  const { schoolName, logoUrl, colorScheme, selectedAccentHsl, setSettings } =
    useSettingsStore();

  const [nameValue, setNameValue] = useState(schoolName);
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [selectingAccent, setSelectingAccent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameValue(schoolName);
  }, [schoolName]);

  const palette: PaletteColor[] =
    (colorScheme as { palette?: PaletteColor[] } | null)?.palette ?? [];
  const currentAccent =
    selectedAccentHsl ??
    (colorScheme as { accent_hsl?: string } | null)?.accent_hsl ??
    "221 83% 53%";

  const handleSaveName = async () => {
    setSavingName(true);
    try {
      await api.put("/settings/identity", { schoolName: nameValue });
      setSettings({ schoolName: nameValue });
      sileo.success({
        title: "Settings Saved",
        description: "School name updated.",
      });
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSavingName(false);
    }
  };

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
      const form = new FormData();
      form.append("logo", file);
      const res = await api.post("/settings/logo", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSettings({
        logoUrl: res.data.logoUrl,
        colorScheme: res.data.colorScheme,
        selectedAccentHsl: res.data.selectedAccentHsl ?? null,
      });
      setLogoPreview(null);
      // Short delay to allow RootLayout to apply CSS variables before toast appears
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

  return (
    <div className="space-y-6">
      {/* School Name */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <School className="h-5 w-5" />
            School Name
          </CardTitle>
          <CardDescription>
            The name displayed across the application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="schoolName">School Name</Label>
              <Input
                className="font-bold"
                id="schoolName"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
              />
            </div>
            <Button
              onClick={handleSaveName}
              disabled={savingName || nameValue === schoolName}>
              {savingName ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logo & Palette */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Palette className="h-5 w-5" />
            Logo & Accent Color
          </CardTitle>
          <CardDescription>
            Upload a logo to extract a color palette. Choose your accent color
            from the extracted palette.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo preview & upload */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted">
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
                <Upload className="h-8 w-8 text-muted-foreground" />
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
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}>
                  <Upload className="mr-2 h-4 w-4" />
                  {uploading ? "Uploading..." : "Upload Logo"}
                </Button>
                {logoUrl && (
                  <Button
                    variant="outline"
                    onClick={handleRemoveLogo}
                    disabled={removingLogo}
                    className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    {removingLogo ? "Removing..." : "Remove"}
                  </Button>
                )}
              </div>
              <p className="text-sm">Accepted: .png, .jpg, .webp — Max 2MB</p>
            </div>
          </div>

          <Separator />

          {/* Extracted Palette */}
          {palette.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold">Extracted Colors</h4>
              <p className="text-sm">
                Click a swatch to set it as the accent color. The system
                automatically adjusts text contrast for WCAG compliance.
              </p>
              <div className="flex flex-wrap gap-3">
                {palette.map((color, i) => {
                  const isSelected = color.hsl === currentAccent;
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => handleSelectAccent(color)}
                        disabled={selectingAccent}
                        className={`group relative h-12 w-12 rounded-lg border-2 transition-all hover:scale-110 ${
                          isSelected
                            ? "border-foreground ring-2 ring-foreground ring-offset-2"
                            : "border-border hover:border-foreground"
                        }`}
                        style={{ backgroundColor: color.hex }}
                        title={`${color.hex} — hsl(${color.hsl})`}>
                        {isSelected && (
                          <Check
                            className="absolute inset-0 m-auto h-5 w-5"
                            style={{ color: `hsl(${color.foreground})` }}
                          />
                        )}
                      </button>
                      <span className="text-xs">{color.hex}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Current Accent */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Current Accent Color</h4>
            <div className="flex items-center gap-4">
              <div
                className="h-10 w-10 rounded-lg shadow-sm border border-border"
                style={{ backgroundColor: `hsl(${currentAccent})` }}
              />
              <div>
                <p className="text-sm ">{`hsl(${currentAccent})`}</p>
                <p className="text-xs text-muted-foreground">
                  {logoUrl ? "From extracted palette" : "Default blue"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Text contrast:{" "}
                  {isAccentLight(currentAccent)
                    ? "Dark text (on light accent)"
                    : "White text (on dark accent)"}
                </p>
              </div>
            </div>
          </div>

          {/* Live Preview */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-medium">Live Preview</p>
            <div className="flex flex-wrap gap-3">
              <Button size="sm">Primary Button</Button>
              <Button size="sm" variant="outline">
                Outline Button
              </Button>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="text-sm text-primary hover:underline pt-2">
                Accent Link
              </a>
            </div>
            <div className="flex gap-2">
              <Badge>Default Badge</Badge>
              <Badge variant="success">Approved</Badge>
              <Badge variant="warning">Pending</Badge>
              <Badge variant="danger">Rejected</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
