// Standard NEN-EN 1089-3 color coding + extras
export const GAS_COLOR_MAPPING: Record<string, string> = {
    // === Pure gassen (NEN-EN 1089-3) ===
    "Zuurstof": "#0EA5E9", // Light Blue
    "Stikstof": "#1F2937", // Dark Gray/Black
    "Koolzuur": "#9CA3AF", // Grey
    "CO2": "#9CA3AF",
    "Kooldioxide": "#9CA3AF",
    "Argon": "#166534", // Dark Green
    "Acetyleen": "#991B1B", // Maroon
    "Helium": "#92400E", // Brown
    "Lachgas": "#1e3a8a", // Dark Blue
    "Distikstofoxide": "#1e3a8a", // N2O = Lachgas
    "Distikstoffmonoxide": "#1e3a8a", // German variant
    "Nitrous Oxide": "#1e3a8a",
    "Perslucht": "#22C55E", // Green
    "Waterstof": "#DC2626", // Red
    "Propaan": "#F97316", // Orange
    "Koolmonoxide": "#EAB308", // Yellow

    // === Lucht / Air (NEN: zwart-wit schouder) ===
    "Lucht": "#4B5563", // Gray-600 (zwart-wit representatie)
    "Adem Lucht": "#4B5563",
    "Ademlucht": "#4B5563",
    "Lucht Droog": "#4B5563",
    "Lucht Synth": "#4B5563",
    "Technische Lucht": "#4B5563",
    "Air Medical": "#4B5563",

    // === Menggas / Weldmix ===
    "Menggas": "#8B5CF6", // Purple
    "Weldmix": "#00ea33ff", // Bright Green
    "Mixed Gas": "#00e94ee2",
    "Sagox": "#00ea33ff",
    "Weldar": "#00ea33ff",
    "ARGOMET": "#166534", // Argon-based → dark green
    "Mag OC": "#8B5CF6", // Menggas → purple

    // === Formeer (H2/N2) ===
    "Formeer": "#F59E0B", // Amber

    // === Carbogeen (CO2/O2) ===
    "Carbogeen": "#9CA3AF", // Grey (CO2-based)

    // === Lasermix ===
    "Lasermix": "#8B5CF6",
    "Lasersol": "#8B5CF6",

    // === Brandbare gassen ===
    "Etheen": "#F97316", // Orange
    "Ethaan": "#F97316",
    "Methaan": "#F97316",
    "Propyleen": "#F97316",

    // === Neon ===
    "Neon": "#F472B6", // Pink
    "NEON": "#F472B6",

    // === Helium mengsel ===
    "He-Premix": "#92400E", // Brown (helium-based)

    // === AliSOL varianten ===
    "AliSOL Zuurstof": "#0EA5E9",
    "AliSOL Stikstof": "#1F2937",
    "AliSOL Kooldioxide": "#9CA3AF",
    "AliSOL": "#6366f1",
    "Alisol": "#6366f1",

    // === SOL producten ===
    "Gasv. SOL": "#166534", // Gasvormig SOL → default dark green (argon-like)
    "BIOSOL": "#22C55E",
    "SOLCAS": "#8B5CF6",

    // === Enermix ===
    "Enermix": "#F59E0B",

    // === Medicinaal ===
    "Medicinaal": "#0EA5E9", // Medical gas → light blue (often O2-based)
    "Medical": "#0EA5E9",

    // === Specifieke menggas-composities ===
    "O2": "#0EA5E9", // Zuurstof
    "N2": "#1F2937", // Stikstof
    "H2": "#DC2626", // Waterstof
    "Ar": "#166534", // Argon
    "He": "#92400E", // Helium

    // English fallback
    "Oxygen": "#0EA5E9",
    "Nitrogen": "#030304ff",
    "Carbon Dioxide": "#9CA3AF",
    "Acetylene": "#991B1B",
    "Compressed Air": "#4B5563",
    "Hydrogen": "#DC2626",
    "Propane": "#F97316",
    "Carbon Monoxide": "#EAB308",
    "Medical grade Oxygen": "#0EA5E9",
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
