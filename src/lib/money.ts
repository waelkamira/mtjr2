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
  const scale = BigInt(10) ** BigInt(minorUnit);
  const minor = whole * scale + BigInt(fractionalMinor || "0");
  return minor.toString();
}


/**
 * Formats a persisted integer minor-unit amount without converting it to
 * Number. This preserves exact digits for large order totals and currencies
 * with zero, two, or three fractional digits.
 */
export function formatMinorUnits(
  amountMinor: string | bigint,
  currencyCode: string,
  minorUnit: number,
  locale?: string
): string {
  if (!Number.isInteger(minorUnit) || minorUnit < 0 || minorUnit > 6) {
    throw new Error("The currency minor-unit precision is invalid.");
  }
  const raw = String(amountMinor);
  if (!/^-?(0|[1-9][0-9]*)$/.test(raw)) {
    throw new Error("The minor-unit amount must be an integer string.");
  }
  const amount = BigInt(raw);
  const negative = amount < BigInt(0);
  const absolute = negative ? -amount : amount;
  const scale = BigInt(10) ** BigInt(minorUnit);
  const whole = absolute / scale;
  const fraction = minorUnit ? (absolute % scale).toString().padStart(minorUnit, "0") : "";
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: minorUnit,
    maximumFractionDigits: minorUnit
  });
  const parts = formatter.formatToParts(negative && whole === BigInt(0) ? BigInt(-1) : negative ? -whole : whole);
  return parts.map((part) => {
    if (part.type === "fraction") return fraction;
    if (negative && whole === BigInt(0) && part.type === "integer") return "0";
    return part.value;
  }).join("");
}
