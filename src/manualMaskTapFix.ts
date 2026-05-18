import type { Zone } from "./detection";

type MaskShape = "rectangle" | "circle" | "oval" | "triangle" | "freehand";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function createTapMaskZone(x: number, y: number, shape: MaskShape): Omit<Zone & { shape?: MaskShape }, "id" | "included"> {
  const isCircle = shape === "circle";
  const width = isCircle ? 10 : 12;
  const height = isCircle ? 10 : 10;

  return {
    x: Number(clamp(x - width / 2, 0, 100 - width).toFixed(2)),
    y: Number(clamp(y - height / 2, 0, 100 - height).toFixed(2)),
    width,
    height,
    shape,
    label: `manual ${shape} avoid zone`
  };
}
