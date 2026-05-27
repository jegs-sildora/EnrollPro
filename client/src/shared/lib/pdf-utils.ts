/**
 * html2canvas 1.x cannot parse oklch() color values emitted by Tailwind CSS v4.
 *
 * Using onclone fires AFTER html2canvas has already begun parsing stylesheets,
 * so the only reliable fix is to patch oklch computed values on the real DOM
 * BEFORE html2canvas is called. The clone then inherits our inline style
 * overrides, and html2canvas never sees a raw oklch string.
 *
 * Returns a cleanup function that restores the original inline values.
 */

const COLOR_PROPS = [
  "color",
  "background-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "fill",
  "stroke",
] as const;

function oklchToRgb(
  ctx: CanvasRenderingContext2D,
  cssColor: string,
): string {
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = cssColor;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  if (data[3] === 0) return "transparent";
  return `rgb(${data[0]}, ${data[1]}, ${data[2]})`;
}

export function fixOklchForCapture(containerEl: HTMLElement): () => void {
  const helperCanvas = document.createElement("canvas");
  helperCanvas.width = 1;
  helperCanvas.height = 1;
  const ctx = helperCanvas.getContext("2d");
  if (!ctx) return () => {};

  const allElements = [
    containerEl,
    ...Array.from(containerEl.querySelectorAll("*")),
  ];

  const restoreMap = new Map<HTMLElement, Map<string, string>>();

  allElements.forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const computed = window.getComputedStyle(el);
    for (const prop of COLOR_PROPS) {
      const val = computed.getPropertyValue(prop);
      if (val.includes("oklch")) {
        if (!restoreMap.has(el)) {
          restoreMap.set(el, new Map());
        }
        restoreMap.get(el)!.set(prop, el.style.getPropertyValue(prop));
        el.style.setProperty(prop, oklchToRgb(ctx, val));
      }
    }
  });

  return () => {
    restoreMap.forEach((props, el) => {
      props.forEach((originalValue, prop) => {
        if (originalValue) {
          el.style.setProperty(prop, originalValue);
        } else {
          el.style.removeProperty(prop);
        }
      });
    });
  };
}
