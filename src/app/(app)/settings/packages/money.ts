/** Convert pence (integer) to pounds (float). */
export function minorToMajor(minor: number | null): number {
  return (minor ?? 0) / 100;
}

/** Convert pounds (string from form input) to pence (integer). */
export function majorStringToMinor(value: string): number {
  const n = parseFloat(value);
  if (isNaN(n) || n < 0) return 0;
  return Math.round(n * 100);
}
