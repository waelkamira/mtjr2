export function toMinorUnits(amountInput: string, minorUnit: number): string {
  if (!Number.isInteger(minorUnit) || minorUnit < 0 || minorUnit > 6) {
    throw new Error("Currency precision is invalid.");
  }
  const amount = amountInput.trim();
  const match = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/.exec(amount);
  if (!match) throw new Error("Enter a valid non-negative shipping amount.");
  const fraction = match[2] ?? "";
  if (fraction.length > minorUnit) {
    throw new Error(`This currency supports at most ${minorUnit} decimal places.`);
  }
  const scale = BigInt(10) ** BigInt(minorUnit);
  const wholeMinor = BigInt(match[1]) * scale;
  const fractionalMinor = BigInt((fraction + "0".repeat(minorUnit)).slice(0, minorUnit) || "0");
  const result = wholeMinor + fractionalMinor;
  if (result > BigInt("9000000000000000")) throw new Error("Shipping amount exceeds the supported limit.");
  return result.toString();
}
