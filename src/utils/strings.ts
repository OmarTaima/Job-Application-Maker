/**
 * Converts a value that may be a localized object (e.g., {en, ar}) to a plain string.
 * Prioritizes English, falls back to Arabic, then stringifies or returns empty string.
 */
export const toPlainString = (val: any): string => {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  
  // Handle arrays (e.g., address array)
  if (Array.isArray(val)) {
    if (val.length === 0) return "";
    // If it's an array of localized objects, extract the first one
    const first = val[0];
    if (typeof first === "object" && (first.en || first.ar)) {
      return first.en || first.ar || "";
    }
    // Otherwise join the array
    return val.filter(v => v).join(", ");
  }
  
  if (typeof val === "object") {
    // Check for localized strings
    if (typeof val.en === "string") return val.en;
    if (typeof val.ar === "string") return val.ar;
    // Fallback: stringify the object
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
};
