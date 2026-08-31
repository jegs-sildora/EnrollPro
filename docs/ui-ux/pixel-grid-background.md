# Pixel Grid Background SVG

This document provides the standardized Pixel Grid background SVG used in EnrollPro, which can be ingested by the AI agents for ATLAS, SMART, and AIMS to ensure consistent UI aesthetics across the Department of Education microservices.

## Usage

This SVG is typically used as a fixed background layer with low opacity (`opacity-[0.08]`) behind the main content layout.

```tsx
<svg
  className="absolute inset-0 w-full h-full opacity-[0.08]"
  xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern
      id="pixel-grid"
      x="0"
      y="0"
      width="80"
      height="80"
      patternUnits="userSpaceOnUse">
      <rect
        x="2"
        y="2"
        width="36"
        height="36"
        rx="2"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
      />
      <rect
        x="42"
        y="2"
        width="36"
        height="36"
        rx="2"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
      />
      <rect
        x="2"
        y="42"
        width="36"
        height="36"
        rx="2"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
      />
      <rect
        x="42"
        y="42"
        width="36"
        height="36"
        rx="2"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
      />
    </pattern>
  </defs>
  <rect
    width="100%"
    height="100%"
    fill="url(#pixel-grid)"
  />
</svg>
```

## Styling Notes

- It relies on `hsl(var(--primary))` for the stroke color to dynamically adapt to the application's theme.
- The `strokeWidth` is `1.5` and `rx` (border radius) is `2` to create a soft, modern pixel-grid effect.
- Wrap this in a container with a solid background color (e.g., `hsl(var(--sidebar-background)/0.5)`) to achieve the layered depth effect.
