/**
 * 2-track four glass centre junction — series JSON often leaves shutterMeeting at 0;
 * preview/BOM still need a realistic visible joint (~interlock, capped for outliers).
 */
export function effectiveFourGlassMeetingMm(seriesMeeting: number | '', interlockMm: number | ''): number {
  const m = Math.max(0, Number(seriesMeeting) || 0);
  const i = Math.max(0, Number(interlockMm) || 0);
  const baseline = i > 0 ? Math.min(Math.max(i, 16), 34) : 22;
  return Math.max(m, baseline);
}
