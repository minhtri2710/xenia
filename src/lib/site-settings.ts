import { isIsoDate } from "./delivery";

export const isRequiredText = (value: unknown): boolean => typeof value === "string" && value.trim().length > 0;
export const isContactEmail = (value: unknown): boolean =>
  typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export function isOptionalHttpsUrl(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export const REQUIRED_TEXT_ERROR = "This field is required.";
export const ISO_DATE_ERROR = "Use a real date in YYYY-MM-DD format.";
export const EMAIL_ERROR = "Enter a valid email address.";
export const HTTPS_URL_ERROR = "Use an https URL or leave this field empty.";

export const validateRequiredText = (value: unknown) => isRequiredText(value) || REQUIRED_TEXT_ERROR;
export const validateSettingsDate = (value: unknown) => isIsoDate(value) || ISO_DATE_ERROR;
export const validateContactEmail = (value: unknown) => isContactEmail(value) || EMAIL_ERROR;
export const validateContactPhone = (value: unknown) => isRequiredText(value) || REQUIRED_TEXT_ERROR;
export const validateOptionalHttpsUrl = (value: unknown) => isOptionalHttpsUrl(value) || HTTPS_URL_ERROR;
