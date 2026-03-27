# Accent Color Variables Reference
## School Admission, Enrollment & Information Management System

**Document Version:** 3.0.0
**System:** PERN Stack (PostgreSQL · Express · React · Node.js)
**Relevant Modules:** All five — Admission (Online + F2F) · Enrollment Management · SIMS · Teacher Management · Grade Level & Sectioning Management
**Scope:** All authenticated dashboard pages, public admission portal (`/apply`), F2F admission form (`/f2f-admission`), student profiles (SIMS), teacher profiles, and section management views

---

## Why This System Has a Dynamic Color Scheme

Every page in this system — the public admission form that students and parents fill out, the registrar's dashboard, the SIMS student profiles, the teacher directory, and the section management views — displays the school's brand. Because this system is built for **any Philippine public secondary school** with zero code changes per deployment, no color value is hardcoded anywhere. When the school administrator uploads their logo in Settings → School Profile, the server extracts the dominant color and persists it to `SchoolSettings.colorScheme`. From that moment, every page automatically becomes on-brand.

---

## Table of Contents

1. [CSS Custom Properties](#1-css-custom-properties)
2. [JavaScript / TypeScript Variables](#2-javascript--typescript-variables)
3. [Database Schema](#3-database-schema)
4. [Color Flow — End-to-End](#4-color-flow--end-to-end)
5. [Token Reference Table](#5-token-reference-table)
6. [Usage Examples Across All Modules](#6-usage-examples-across-all-modules)
7. [WCAG Contrast Calculation](#7-wcag-contrast-calculation)
8. [Color Format Rules](#8-color-format-rules)
9. [Update Triggers](#9-update-triggers)
10. [School-Agnostic Design Rules](#10-school-agnostic-design-rules)

---

## 1. CSS Custom Properties

### 1.1 Default Values — `client/src/index.css`

These baseline values apply when no logo has been uploaded. They represent a neutral professional blue that works for any school.

```css
/* client/src/index.css */
@import "tailwindcss";

@theme {
  --font-sans: 'Instrument Sans', ui-sans-serif, system-ui;
}

:root {
  /* ─── PERMANENT MAIN LAYER — NEVER overridden by color extraction ─── */
  --background:             0 0% 100%;       /* Pure white page background         */
  --foreground:             222 47% 11%;     /* Near-black body text               */
  --muted:                  220 14% 96%;     /* Light grey surfaces, table rows     */
  --muted-foreground:       215 16% 47%;     /* Subdued labels, placeholders        */
  --border:                 220 13% 91%;     /* Card, input, and divider borders    */
  --card:                   0 0% 100%;       /* Card background                     */
  --card-foreground:        222 47% 11%;     /* Card body text                      */
  --popover:                0 0% 100%;       /* Dropdown / popover surface          */
  --popover-foreground:     222 47% 11%;     /* Dropdown text                       */
  --destructive:            0 84% 60%;       /* Danger / reject / delete red        */
  --destructive-foreground: 0 0% 100%;       /* White text on destructive           */

  /* ─── ACCENT LAYER — default blue; overridden on logo upload ─────── */
  --accent:                 221 83% 53%;     /* Default blue — replaced by logo color */
  --accent-foreground:      0 0% 100%;       /* White on default blue               */
  --accent-muted:           213 97% 94%;     /* Light tint for nav, hover states    */
  --accent-ring:            221 83% 53%;     /* Focus ring on all interactive elements */

  /* shadcn/ui semantic aliases — always mirror the accent tokens above */
  --primary:                var(--accent);
  --primary-foreground:     var(--accent-foreground);
  --ring:                   var(--accent-ring);

  /* Sidebar tokens — also accent-derived */
  --sidebar-primary:              var(--accent);
  --sidebar-primary-foreground:   var(--accent-foreground);
  --sidebar-accent:               var(--accent-muted);
  --sidebar-accent-foreground:    222 47% 11%;   /* Always dark regardless of accent */
  --sidebar-ring:                 var(--accent-ring);
}
```

> **Critical rule:** Only the four `--accent-*` tokens and their named aliases are ever overridden at runtime. The main layer tokens (`--background`, `--foreground`, `--border`, etc.) are **permanent** and must never be written by the color extraction system.

### 1.2 Dynamic Override — `client/src/layouts/RootLayout.tsx`

When `settingsStore` receives a `colorScheme` from `GET /api/settings/public`, `RootLayout` injects the override before the first paint:

```typescript
// client/src/layouts/RootLayout.tsx
useLayoutEffect(() => {
  const root = document.documentElement;

  // Only the accent layer is touched — main layer is never modified
  root.style.setProperty('--accent',                       accent);
  root.style.setProperty('--accent-foreground',            fg);
  root.style.setProperty('--accent-muted',                 mutedAccent);
  root.style.setProperty('--accent-ring',                  accent);
  root.style.setProperty('--primary',                      accent);
  root.style.setProperty('--primary-foreground',           fg);
  root.style.setProperty('--ring',                         accent);
  root.style.setProperty('--sidebar-primary',              accent);
  root.style.setProperty('--sidebar-primary-foreground',   fg);
  root.style.setProperty('--sidebar-ring',                 accent);
  root.style.setProperty('--sidebar-accent',               mutedAccent);
  root.style.setProperty('--sidebar-accent-foreground',    mutedFg);
}, [accent, fg, mutedAccent, mutedFg]);
```

`useLayoutEffect` is intentional — it fires synchronously after DOM mutations but before the browser paints, eliminating any visible flash of the default blue.

---

### 1.3 Special Case — DepEd Yellow Override

If the extracted or selected accent color is **DepEd Yellow (#fefe01)**, the system applies a special readability override for the primary background. This ensures that text (which would otherwise be black on yellow) can be white on a high-contrast dark blue background, maintaining a professional aesthetic for the Online Admission Portal and other modules.

- **Trigger Color:** `#fefe01` (HSL: `60 99% 50%`)
- **Override Background:** `#061E29` (HSL: `200 68% 9%`)
- **Override Foreground:** White (HSL: `0 0% 100%`)

This override is applied to `--primary`, `--primary-foreground`, and `--sidebar-primary` tokens while leaving the original accent color available for other elements.

---

## 2. JavaScript / TypeScript Variables

### 2.1 Constant — `client/src/layouts/RootLayout.tsx`

```typescript
// Fallback used when no logo has been uploaded and colorScheme is null
const DEFAULT_ACCENT_HSL = '221 83% 53%';
```

### 2.2 Zustand Settings Store Interface — `client/src/stores/settingsStore.ts`

```typescript
export interface PaletteColor {
  hsl:        string;   // e.g. "221 83% 53%"   — comma-free space-separated HSL
  hex:        string;   // e.g. "#3b82f6"        — display only, never used in CSS vars
  foreground: string;   // "0 0% 0%" or "0 0% 100%"   — WCAG-calculated
}

interface ColorScheme {
  accent_hsl:        string;          // Primary accent extracted from logo
  accent_foreground: string;          // WCAG foreground for accent_hsl
  palette:           PaletteColor[];  // Up to 8 chromatic swatches
  extracted_at:      string;          // ISO 8601 timestamp of last extraction
}

export interface SettingsState {
  schoolName:             string | null;   // From SchoolSettings — NEVER hardcoded in UI
  schoolId:               string | null;   // DepEd School ID
  division:               string | null;   // e.g. "Schools Division of Negros Occidental"
  region:                 string | null;   // e.g. "Region VI - Western Visayas"
  logoUrl:                string | null;   // Public URL served to all clients
  colorScheme:            ColorScheme | null;
  selectedAccentHsl:      string | null;   // User's explicit swatch override
  accentForeground:       string | null;   // Computed; session-only
  accentMutedForeground:  string | null;   // Computed; session-only
  enrollmentOpen:         boolean;
  activeYear:             { id: number; yearLabel: string } | null;
  admissionChannels:      string[];        // ["ONLINE", "F2F"] — school-configurable
}
```

### 2.3 Accent Selection Priority

```typescript
// client/src/layouts/RootLayout.tsx
const accent =
  selectedAccentHsl           // 1. Registrar's explicit choice from palette picker
  ?? colorScheme?.accent_hsl  // 2. Auto-extracted dominant color from uploaded logo
  ?? DEFAULT_ACCENT_HSL;      // 3. Default blue (no logo, no selection)

// Derived values
const fg          = contrastForeground(accent);    // WCAG-compliant: black or white
const [h, s]      = accent.split(' ');
const mutedAccent = `${h} ${s} 94%`;               // Same hue & saturation, lightness = 94%
const mutedFg     = contrastForeground(mutedAccent);
```

---

## 3. Database Schema

### 3.1 Prisma Model

```prisma
// server/prisma/schema.prisma

model SchoolSettings {
  id                   Int      @id @default(autoincrement())
  schoolName           String                       // Displayed everywhere — never hardcoded in components
  schoolId             String?                      // DepEd School ID (configurable)
  division             String?                      // Schools Division name
  region               String?                      // DepEd Region
  logoPath             String?                      // Server filesystem path for the uploaded file
  logoUrl              String?                      // Public URL served to all clients
  colorScheme          Json?                        // ColorScheme object (see §3.2)
  selectedAccentHsl    String?                      // Currently active accent choice
  enrollmentOpen       Boolean  @default(false)
  activeAcademicYearId Int?
  admissionChannels    String[] @default(["ONLINE", "F2F"])  // Active admission channels

  activeAcademicYear   AcademicYear? @relation(fields: [activeAcademicYearId], references: [id])
}
```

### 3.2 `colorScheme` JSON Structure (stored in DB)

```json
{
  "accent_hsl":        "221 83% 53%",
  "accent_foreground": "0 0% 100%",
  "palette": [
    { "hsl": "221 83% 53%", "hex": "#3b7ff5", "foreground": "0 0% 100%" },
    { "hsl": "221 65% 38%", "hex": "#235cb8", "foreground": "0 0% 100%" },
    { "hsl": "48  96% 52%", "hex": "#f9c61e", "foreground": "0 0% 0%"   }
  ],
  "extracted_at": "2026-06-01T08:00:00.000Z"
}
```

Up to 8 chromatic colors, sorted by frequency × saturation. The most dominant becomes `accent_hsl`. The example values above are **illustrative only** — the actual values depend entirely on the school's uploaded logo.

---

## 4. Color Flow — End-to-End

### State 1 — Fresh Installation (No Logo Uploaded)

```
Database:      colorScheme = null   ·   selectedAccentHsl = null
Zustand store: colorScheme = null   ·   selectedAccentHsl = null
CSS variables: --accent: 221 83% 53%   (default blue #3b82f6)
               --accent-foreground: 0 0% 100%   (white)
               --primary: var(--accent)
Result:        All buttons, active nav items, focus rings → default blue
               schoolName shown as whatever is in SchoolSettings.schoolName
```

### State 2 — Logo Uploaded

```
HTTP:    POST /api/settings/logo   (multipart/form-data, max 2 MB)

Server (logoColorService.ts):
  1. Multer saves file → /uploads/logos/{uuid}.{ext}
  2. Sharp resizes to 64×64
  3. color-thief-node extracts pixel color buckets
  4. Sort by frequency × saturation; select up to 8 chromatic colors
  5. Compute WCAG foreground for each (contrastForeground())
  6. Build ColorScheme object; set accent_hsl = most dominant
  7. Prisma: UPDATE SchoolSettings SET
       logoPath, logoUrl, colorScheme (JSON), selectedAccentHsl
  8. Response: { logoUrl, colorScheme, selectedAccentHsl }

Zustand:   settingsStore.setColorScheme(data)
RootLayout: useLayoutEffect fires → CSS variables updated (no reload)
Result:    Every accent element in every module reflects the school's logo color
```

### State 3 — Registrar Selects a Different Swatch

```
HTTP:    PUT /api/settings/accent   { hsl: "48 96% 52%" }
Server:  SchoolSettings.selectedAccentHsl = "48 96% 52%"
Zustand: selectedAccentHsl updated
RootLayout: useLayoutEffect fires instantly
Result:  All accent elements switch color without page refresh
```

### State 4 — Logo Removed

```
HTTP:    DELETE /api/settings/logo
Server:  logoPath = null · logoUrl = null · colorScheme = null · selectedAccentHsl = null
Zustand: all cleared
RootLayout: useLayoutEffect fires → resets to DEFAULT_ACCENT_HSL
Result:  All accent elements revert to default blue
```

---

## 5. Token Reference Table

### Accent Layer (overridden at runtime — these are the only ones that change)

| Variable | Default Value | Role |
|---|---|---|
| `--accent` | `221 83% 53%` | All primary buttons, active states, selected badges |
| `--accent-foreground` | `0 0% 100%` | Text on accent backgrounds — always WCAG AA compliant |
| `--accent-muted` | `213 97% 94%` | Active sidebar item background, hover surfaces |
| `--accent-ring` | `221 83% 53%` | Focus rings on all interactive elements |
| `--primary` | `var(--accent)` | shadcn/ui alias |
| `--primary-foreground` | `var(--accent-foreground)` | shadcn/ui alias |
| `--ring` | `var(--accent-ring)` | shadcn/ui alias |
| `--sidebar-primary` | `var(--accent)` | Sidebar active item color |
| `--sidebar-primary-foreground` | `var(--accent-foreground)` | Sidebar active item text |
| `--sidebar-accent` | `var(--accent-muted)` | Sidebar hover background |
| `--sidebar-accent-foreground` | `222 47% 11%` | Sidebar hover text (always dark) |
| `--sidebar-ring` | `var(--accent-ring)` | Sidebar focus ring |

### Main Layer (permanent — never changed by color extraction)

| Variable | Value | Role |
|---|---|---|
| `--background` | `0 0% 100%` | Page background |
| `--foreground` | `222 47% 11%` | Body text |
| `--muted` | `220 14% 96%` | Table row stripes, subdued surfaces |
| `--muted-foreground` | `215 16% 47%` | Labels, help text, placeholders |
| `--border` | `220 13% 91%` | Card, input, divider borders |
| `--card` | `0 0% 100%` | Card backgrounds |
| `--destructive` | `0 84% 60%` | Reject / delete / error |
| `--destructive-foreground` | `0 0% 100%` | Text on destructive backgrounds |

---

## 6. Usage Examples Across All Modules

### Online Admission (`/apply`) — Step Progress Bar

```tsx
// Each completed step dot uses the school's accent color
<div className={`w-3 h-3 rounded-full transition-colors ${
  step > i ? 'bg-[hsl(var(--accent))]' :
  step === i ? 'ring-2 ring-[hsl(var(--accent-ring))] bg-[hsl(var(--accent))]' :
  'bg-muted'
}`} />
```

### F2F Admission (`/f2f-admission`) — Submit Button

```tsx
// Registrar's walk-in admission form — same tokens as the public portal
<Button type="submit"
  className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90">
  Save Walk-in Application
</Button>
```

### Enrollment Management (`/applications`) — Approve CTA

```tsx
// Approval dialog confirm button uses the school's primary color
<Button variant="default">   {/* shadcn uses --primary automatically */}
  Approve & Assign Section
</Button>
```

### SIMS (`/students`) — Active Sidebar Item

```tsx
<NavLink to="/students"
  className={({ isActive }) => isActive
    ? 'flex items-center gap-2 px-3 py-2 rounded-md ' +
      'border-l-2 border-[hsl(var(--accent))] ' +
      'bg-[hsl(var(--accent-muted))] text-[hsl(var(--accent))] font-medium'
    : 'flex items-center gap-2 px-3 py-2 rounded-md text-muted-foreground hover:bg-muted'
  }
>
  <Users className="w-4 h-4" />
  Students
</NavLink>
```

### Teacher Management (`/teachers`) — Profile View
The teacher profile views (`/teachers/:id`) use the accent color for active tabs and buttons.

### Sections (`/sections`) — Capacity Bar

The capacity bar uses **semantic colors only** — not the accent color — because it encodes meaning (safe / warning / full) that must remain consistent regardless of school branding.

```tsx
const pct = (enrolled / maxCapacity) * 100;
const barColor =
  pct < 80  ? 'bg-green-500' :
  pct < 100 ? 'bg-amber-500' : 'bg-red-500';

<div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
  <div className={`h-full transition-all ${barColor}`}
       style={{ width: `${Math.min(pct, 100)}%` }} />
</div>
```

### Settings (`/settings`) — Palette Swatch Picker

```tsx
{colorScheme?.palette?.map(({ hsl, hex }) => (
  <button
    key={hsl}
    onClick={() => handleAccentSelect(hsl)}
    style={{ background: `hsl(${hsl})` }}
    title={hex}
    aria-label={`Use ${hex} as accent`}
    className={`w-8 h-8 rounded-full transition-all ${
      selectedAccentHsl === hsl
        ? 'ring-2 ring-offset-2 ring-[hsl(var(--accent-ring))] scale-110'
        : 'hover:scale-105 opacity-80 hover:opacity-100'
    }`}
  />
))}
```

---

## 7. WCAG Contrast Calculation

Every accent color extracted from a school logo is automatically tested for contrast before being used as a foreground — the system never blindly applies an arbitrary color for text.

```typescript
// server/src/services/logoColorService.ts  (server-side, runs at extraction time)
// client/src/lib/colorUtils.ts             (client-side, runs at CSS override time)

function relativeLuminance(hsl: string): number {
  // WCAG 2.1 luminance formula: HSL → sRGB → linear → relative luminance
  const [h, s, l] = hsl.split(' ').map(parseFloat);
  // ... full conversion
}

function contrastForeground(accentHsl: string): '0 0% 100%' | '0 0% 0%' {
  const lum            = relativeLuminance(accentHsl);
  const contrastWhite  = 1.05 / (lum + 0.05);
  const contrastBlack  = (lum + 0.05) / 0.05;
  // Return whichever achieves higher contrast — always WCAG AA or better
  return contrastWhite >= contrastBlack ? '0 0% 100%' : '0 0% 0%';
}
```

**Illustrative examples:**

| Accent | White contrast | Black contrast | Foreground |
|---|---|---|---|
| `221 83% 53%` (default blue) | 4.6:1 ✅ AA | 4.6:1 equal | **White** |
| `60 98% 50%` (bright yellow) | 1.1:1 ❌ | 19.5:1 ✅ AAA | **Black** |
| `60 86% 18%` (dark olive) | 8.2:1 ✅ AAA | 2.6:1 — | **White** |
| `0 70% 40%` (dark red) | 6.8:1 ✅ AAA | 3.1:1 — | **White** |

Contrast is calculated independently for both the accent and the muted accent — a light swatch like `60 98% 94%` (very pale yellow) will correctly use dark text even if its parent accent uses white text.

---

## 8. Color Format Rules

All CSS custom property values use **space-separated HSL without `hsl()` wrapper and without commas**. This is required by Tailwind CSS v4 and shadcn/ui.

```
✅ Correct:  221 83% 53%
✅ Correct:  0 0% 100%
❌ Wrong:    hsl(221, 83%, 53%)
❌ Wrong:    221, 83%, 53%
❌ Wrong:    #3b82f6   (hex is for display only; never used in CSS variables)
```

**Setting via JS:** `root.style.setProperty('--accent', '221 83% 53%')` — the value string has no wrapper.
**Using in Tailwind classes:** `bg-[hsl(var(--accent))]` — Tailwind wraps it at the class level.

---

## 9. Update Triggers

CSS variables are updated under exactly four conditions:

| Trigger | When it Fires | Mechanism |
|---|---|---|
| Page load / RootLayout mount | Every page visit | `useLayoutEffect` reads Zustand store → applies variables |
| Logo upload | Registrar uploads logo in Settings Tab 1 | Server extracts → API response → Zustand update → `useLayoutEffect` |
| Palette swatch selection | Registrar clicks a swatch in Settings Tab 1 | `PUT /api/settings/accent` → Zustand update → `useLayoutEffect` |
| Logo removal | Registrar removes the current logo | API clears `colorScheme` → Zustand cleared → reset to `DEFAULT_ACCENT_HSL` |

All changes are **instantaneous** — no page reload, no flash, no delay.

---

## 10. School-Agnostic Design Rules

This system deploys at any Philippine public secondary school with zero code changes. The following rules are enforced at code review.

| Subject | Correct Pattern | Prohibited |
|---|---|---|
| School name in JSX | `{settings.schoolName}` | Any string literal like `"Quezon NHS"` |
| School name in emails | `${settings.schoolName}` token substitution | Hardcoded school name in any template file |
| Logo URL | `{settings.logoUrl}` | Any hardcoded path like `/assets/logo.png` |
| Accent color | `bg-[hsl(var(--primary))]` · `text-[hsl(var(--accent))]` | `bg-blue-600`, `#3b82f6`, any hardcoded color |
| Division / Region (privacy notice) | `{settings.division}` · `{settings.region}` | `"Schools Division of Negros Occidental"` |
| Default fallback color | `DEFAULT_ACCENT_HSL = '221 83% 53%'` (defined once) | Any school-specific color as a default anywhere in code |
| Capacity bar | Semantic: `bg-green-500 / bg-amber-500 / bg-red-500` | Accent color — this bar's meaning must not change per school |

**When this system is deployed at a new school:** the admin uploads their logo, sets the school name, division, and region in Settings, and the entire system — all five modules — instantly reflects the correct identity. No developer intervention required.

---

*Document v3.0.0*
*System: School Admission, Enrollment & Information Management System*
*Modules: Admission (Online + F2F) · Enrollment Management · SIMS · Teacher Management · Grade Level & Sectioning Management*
*Stack: PERN (PostgreSQL 18 · Express.js 5.1 · React 19.x · Node.js 22 LTS)*
*School-agnostic: all brand values are runtime-configurable — zero code changes per deployment*