/**
 * Converts a human-entered major-unit amount to an integer minor-unit string.
 * Uses decimal text and BigInt so currency conversion never relies on binary
 * floating-point rounding.
 */
export function toMinorUnits(amount: string | number, minorUnit: number): string {
  if (!Number.isInteger(minorUnit) || minorUnit < 0 || minorUnit > 6) {
    throw new Error("The currency minor-unit precision is invalid.");
  }
  const value = String(amount).trim();
  const match = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/.exec(value);
  if (!match) throw new Error("Enter a valid non-negative monetary amount.");
  const whole = BigInt(match[1]);
  const fraction = match[2] ?? "";
  if (fraction.length > minorUnit && /[1-9]/.test(fraction.slice(minorUnit))) {
    throw new Error(`This currency supports at most ${minorUnit} decimal places.`);
  }
  const fractionalMinor = fraction.slice(0, minorUnit).padEnd(minorUnit, "0");
  const scale = 10n ** BigInt(minorUnit);
  const minor = whole * scale + BigInt(fractionalMinor || "0");
  return minor.toString();
}
