// Standard NEN-EN 1089-3 color coding + extras
export const GAS_COLOR_MAPPING: Record<string, string> = {
    "Zuurstof": "#0EA5E9", // Light Blue (Standard: White/Blue)
    "Stikstof": "#1F2937", // Black (Standard: Black) - using Dark Gray for UI
    "Koolzuur": "#9CA3AF", // Grey (Standard: Grey)
    "CO2": "#9CA3AF", // CO2 (Same as Koolzuur)
    "Kooldioxide": "#9CA3AF", // Kooldioxide (Same as Koolzuur)
    "Argon": "#166534", // Dark Green (Standard: Dark Green)
    "Acetyleen": "#991B1B", // Maroon (Standard: Maroon)
    "Helium": "#92400E", // Brown (Standard: Brown)
    "Lachgas": "#2563EB", // Blue (Standard: Blue)
    "Perslucht": "#22C55E", // Green (Standard: Bright Green)
    "Waterstof": "#DC2626", // Red (Standard: Red)
    "Menggas": "#8B5CF6", // Purple (Generic)
    "Propaan": "#F97316", // Orange
    "Koolmonoxide": "#EAB308", // Yellow
    // English fallback
    "Oxygen": "#0EA5E9",
    "Nitrogen": "#030304ff",
    "Carbon Dioxide": "#9CA3AF",
    // Argon is same in NL/EN
    "Acetylene": "#991B1B",
    // Helium is same in NL/EN
    "Nitrous Oxide": "#2563EB",
    "Compressed Air": "#22C55E",
    "Hydrogen": "#DC2626",
    "Mixed Gas": "#00e94ee2",
    "Propane": "#F97316",
    "Carbon Monoxide": "#EAB308",
    "Weldmix": "#00ea33ff",

};

export const getGasColor = (name: string, defaultColor: string = "#8b5cf6"): string => {
    if (!name) return defaultColor;

    // Direct match
    if (GAS_COLOR_MAPPING[name]) {
        return GAS_COLOR_MAPPING[name];
    }

    const lowerName = name.toLowerCase().trim();

    // Case-insensitive exact match
    const foundKey = Object.keys(GAS_COLOR_MAPPING).find(k => k.toLowerCase() === lowerName);
    if (foundKey) {
        return GAS_COLOR_MAPPING[foundKey];
    }

    // Partial match (contains)
    const partialKey = Object.keys(GAS_COLOR_MAPPING).find(k => lowerName.includes(k.toLowerCase()));
    if (partialKey) {
        return GAS_COLOR_MAPPING[partialKey];
    }

    return defaultColor;
};
