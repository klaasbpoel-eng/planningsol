import { api } from "@/lib/api";

/**
 * Fetches all gas types and returns a Set of product names that are digital.
 * Used by multiple components to filter out digital cylinders when hideDigital is active.
 */
export async function buildDigitalProductNames(): Promise<Set<string>> {
  try {
    const types = await api.gasTypes.getAllIncludingInactive();
    return new Set<string>(
      (types || [])
        .filter((t: any) => t.is_digital)
        .map((t: any) => String(t.name))
    );
  } catch {
    return new Set<string>();
  }
}
