import flags from "@/config/feature-flags.json";

export function flagActivo(key: keyof typeof flags): boolean {
  if (!Object.prototype.hasOwnProperty.call(flags, key)) return false;
  const override = process.env[`FEATURE_${String(key).toUpperCase()}`];
  if (override === "true") return true;
  if (override === "false") return false;
  return flags[key] === true;
}
