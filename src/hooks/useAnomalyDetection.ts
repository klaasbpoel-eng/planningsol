import { useMemo } from "react";

export interface AnomalyResult {
  isAnomaly: boolean;
  type: "spike" | "drop" | "unusual" | null;
  severity: "low" | "medium" | "high" | null;
  message: string | null;
  percentDeviation: number;
}

/**
 * Detect anomalies using statistical analysis (Z-score method)
 * An anomaly is detected when a value deviates significantly from the mean
 */
export function detectAnomaly(
  currentValue: number,
  historicalValues: number[],
  options: {
    sensitivityThreshold?: number; // Z-score threshold (default: 2 = ~95% confidence)
    minDataPoints?: number; // Minimum data points needed for analysis
  } = {}
): AnomalyResult {
  const { sensitivityThreshold = 2, minDataPoints = 4 } = options;

  // Not enough data for meaningful analysis
  if (historicalValues.length < minDataPoints) {
    return {
      isAnomaly: false,
      type: null,
      severity: null,
      message: null,
      percentDeviation: 0,
    };
  }

  // Calculate mean and standard deviation
  const mean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
  const variance =
    historicalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    historicalValues.length;
  const stdDev = Math.sqrt(variance);

  // If stdDev is very small (nearly constant values), use a minimum threshold
  const effectiveStdDev = Math.max(stdDev, mean * 0.1);

  // Calculate Z-score
  const zScore = effectiveStdDev > 0 ? (currentValue - mean) / effectiveStdDev : 0;
  const percentDeviation = mean > 0 ? Math.round(((currentValue - mean) / mean) * 100) : 0;

  // Determine if it's an anomaly
  const isAnomaly = Math.abs(zScore) >= sensitivityThreshold;

  if (!isAnomaly) {
    return {
      isAnomaly: false,
      type: null,
      severity: null,
      message: null,
      percentDeviation,
    };
  }

  // Determine type and severity
  const type = zScore > 0 ? "spike" : "drop";
  
  let severity: "low" | "medium" | "high";
  if (Math.abs(zScore) >= 3) {
    severity = "high";
  } else if (Math.abs(zScore) >= 2.5) {
    severity = "medium";
  } else {
    severity = "low";
  }

  // Generate message
  const direction = type === "spike" ? "hoger" : "lager";
  const severityText = severity === "high" ? "significant" : severity === "medium" ? "duidelijk" : "iets";
  const message = `${severityText} ${direction} dan gemiddeld (${percentDeviation > 0 ? "+" : ""}${percentDeviation}%)`;

  return {
    isAnomaly: true,
    type,
    severity,
    message,
    percentDeviation,
  };
}

/**
 * Hook to detect anomalies in production data
 */
export function useAnomalyDetection(
  currentValue: number,
  historicalValues: number[],
  options?: {
    sensitivityThreshold?: number;
    minDataPoints?: number;
  }
): AnomalyResult {
  return useMemo(
    () => detectAnomaly(currentValue, historicalValues, options),
    [currentValue, JSON.stringify(historicalValues), options?.sensitivityThreshold, options?.minDataPoints]
  );
}

/**
 * Analyze multiple data points for anomalies
 */
export function analyzeAnomalies(
  dataPoints: { label: string; current: number; historical: number[] }[],
  options?: {
    sensitivityThreshold?: number;
    minDataPoints?: number;
  }
): { label: string; result: AnomalyResult }[] {
  return dataPoints.map((point) => ({
    label: point.label,
    result: detectAnomaly(point.current, point.historical, options),
  }));
}
