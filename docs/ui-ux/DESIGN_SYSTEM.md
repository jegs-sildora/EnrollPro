# EnrollPro Design System

Last reviewed: 2026-07-24

## Brand

EnrollPro uses colors extracted from the uploaded school logo through shared theme tokens such as `--primary`, `--accent`, and `--ring`. Do not copy the SMART sidebar or emerald palette into EnrollPro.

Semantic amber and red are reserved for genuine warnings and destructive actions.

## Application Shell

The staff shell keeps school identity, navigation, active school year, accessibility controls, and account actions stable while route content changes. Desktop and mobile navigation must preserve the same route permissions and plain labels.

## Typography

The smallest permitted visible font size is Tailwind `text-sm`. Use larger sizes for table content, form labels, page headings, and primary actions when space allows. Avoid condensed uppercase technical wording for body copy.

## Shared Patterns

- Page headers use a title, task-based subtitle, and clear primary action.
- Cards use one radius and elevation system without nested decorative cards.
- Toolbars group search, filters, refresh, and clear actions without gaps or overflow.
- Tables use responsive columns on desktop and stacked records on narrow screens when needed.
- Forms group related school-office fields and show corrective validation messages.
- Dialogs and sheets use the shared content width, focus handling, close animation, and action order.
- Loading uses layout-matched skeletons in the content area while the application shell remains visible.
- Motion uses subtle opacity and short spatial transitions with reduced-motion support.
- Dirty forms use the shared unsaved-change dialog before route, tab, or panel changes.

## Responsive Behavior

Avoid horizontal page scrolling. Search controls grow before filters. Long names truncate with access to the full value. Mobile actions remain touch-sized and do not rely on icon-only controls without labels or tooltips.

## Accessibility

Use semantic controls, visible keyboard focus, sufficient contrast, meaningful labels, and status text in addition to color. Dialogs trap focus. Cards that navigate must be real links or buttons. All interactions must support keyboard operation.

## Language

Use plain English and familiar DepEd terms:

- Learner Enrollment
- Class Sectioning and SF1
- Personnel Directory
- Class Adviser
- Subject Area
- Official Position
- School Requirements
- School Year

Avoid vague software terms when a school-office action can be named directly.

## Product Exclusions

Do not add screens or wording for Early Registration, reading assessment, enrollment listings, hardware, or Internet of Things workflows. Those are not EnrollPro processes.
