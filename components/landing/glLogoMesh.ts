/**
 * Reconstruct the approved Daira emblem's alpha silhouette into a thin
 * extruded triangle mesh; no fabricated D geometry or external model host.
 * Geometry is cached across the hero and feature WebGL contexts.
 *
 * One grid cell gives two front/back faces; exposed boundary cells provide
 * side walls, including around the hole in the D. 72px is intentionally
 * modest to keep low-power phones responsive.
 */
export type LogoMesh = { vertices: Float32Array; vertexCount: number };
let pending: Promise<LogoMesh> | undefined;
const SAMPLES = 72;
const STRIDE = 9; // xyz position, xyz normal, rgb vertex color
const FRONT = 0.13;
const BACK = -0.17;

function meshFromImage(image: HTMLImageElement): LogoMesh {
  const scratch = document.createElement("canvas");
  scratch.width = scratch.height = SAMPLES;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D unavailable");
  // The approved mark is the first square at the LEFT of the complete wordmark.
  const sourceSide = Math.min(image.naturalHeight * 1.045, image.naturalWidth * 0.39);
  ctx.clearRect(0, 0, SAMPLES, SAMPLES);
  ctx.drawImage(image, 0, 0, sourceSide, image.naturalHeight, 0, 0, SAMPLES, SAMPLES);
  const pixels = ctx.getImageData(0, 0, SAMPLES, SAMPLES).data;
  const solid = new Uint8Array(SAMPLES * SAMPLES);
  for (let i = 0; i < solid.length; i++) solid[i] = pixels[i * 4 + 3] >= 110 ? 1 : 0;
  if (solid.reduce((sum, x) => sum + x, 0) < 200) throw new Error("Logo silhouette unavailable");

  const vertices: number[] = [];
  const side = 1.78 / SAMPLES;
  const visible = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < SAMPLES && y < SAMPLES && solid[y * SAMPLES + x] !== 0;
  function quad(
    a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[],
    normal: readonly number[], color: readonly number[],
  ) {
    for (const p of [a, b, c, a, c, d]) vertices.push(
      p[0], p[1], p[2], normal[0], normal[1], normal[2], color[0], color[1], color[2],
    );
  }
  for (let y = 0; y < SAMPLES; y++) for (let x = 0; x < SAMPLES; x++) {
    if (!visible(x, y)) continue;
    const o = (y * SAMPLES + x) * 4;
    const color = [Math.max(0.1, pixels[o] / 255), Math.max(0.2, pixels[o + 1] / 255), Math.max(0.35, pixels[o + 2] / 255)];
    const edgeColor = [color[0] * 0.48, color[1] * 0.59, color[2] * 0.72];
    const left = -0.89 + x * side, right = left + side;
    const top = 0.89 - y * side, bottom = top - side;
    const fTL = [left, top, FRONT], fTR = [right, top, FRONT];
    const fBL = [left, bottom, FRONT], fBR = [right, bottom, FRONT];
    const bTL = [left, top, BACK], bTR = [right, top, BACK];
    const bBL = [left, bottom, BACK], bBR = [right, bottom, BACK];
    quad(fTL, fTR, fBR, fBL, [0, 0, 1], color);
    quad(bTR, bTL, bBL, bBR, [0, 0, -1], edgeColor);
    if (!visible(x, y - 1)) quad(bTL, bTR, fTR, fTL, [0, 1, 0], edgeColor);
    if (!visible(x, y + 1)) quad(fBL, fBR, bBR, bBL, [0, -1, 0], edgeColor);
    if (!visible(x - 1, y)) quad(bTL, fTL, fBL, bBL, [-1, 0, 0], edgeColor);
    if (!visible(x + 1, y)) quad(fTR, bTR, bBR, fBR, [1, 0, 0], edgeColor);
  }
  return { vertices: new Float32Array(vertices), vertexCount: vertices.length / STRIDE };
}
export function getLogoMesh(): Promise<LogoMesh> {
  if (pending) return pending;
  pending = new Promise<LogoMesh>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      try { resolve(meshFromImage(image)); }
      catch (error) { reject(error); }
    };
    image.onerror = () => reject(new Error("Failed to load the Daira emblem"));
    image.src = "/daira-header-logo-hd.webp";
  }).catch(error => { pending = undefined; throw error; });
  return pending;
}
