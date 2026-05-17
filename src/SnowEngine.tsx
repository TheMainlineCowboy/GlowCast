export type SnowMaskZone = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  included: boolean;
  shape?: "rectangle" | "circle" | "oval" | "triangle" | "freehand";
  label?: string;
};

export function snowEngineReady() {
  return true;
}
