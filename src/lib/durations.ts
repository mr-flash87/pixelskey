// Centralized duration definitions for product tiers.
// Used by admin (tier editor), product page (tier picker) and order summary.

export type DurationKey =
  | "1_month"
  | "3_months"
  | "6_months"
  | "1_year"
  | "2_years"
  | "lifetime";

export const DURATION_OPTIONS: { value: DurationKey; label: string }[] = [
  { value: "1_month", label: "1 mois" },
  { value: "3_months", label: "3 mois" },
  { value: "6_months", label: "6 mois" },
  { value: "1_year", label: "1 an" },
  { value: "2_years", label: "2 ans" },
  { value: "lifetime", label: "À vie" },
];

export const durationLabel = (value?: string | null): string => {
  if (!value) return "";
  return DURATION_OPTIONS.find((d) => d.value === value)?.label ?? value;
};
