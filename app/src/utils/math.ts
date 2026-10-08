export function computeBezierWire(sx: number, sy: number, tx: number, ty: number): string {
  const dx = Math.max(60, Math.abs(tx - sx) * 0.55);
  return `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
}
