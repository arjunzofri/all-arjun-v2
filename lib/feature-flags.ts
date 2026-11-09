import flags from "@/config/feature-flags.json";

export function flagActivo(key: keyof typeof flags): boolean {
  return flags[key] === true;
}
