/**
 * Profile display name & username sanitizer & validator (#4370).
 * Ensures display names and usernames are properly trimmed, validated for minimum length,
 * and client-side validation errors returned before submitting profile updates.
 */

export const MIN_DISPLAY_NAME_LENGTH = 2;
export const MAX_DISPLAY_NAME_LENGTH = 50;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 30;

export function sanitizeDisplayName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "");
}

export interface DisplayNameValidationResult {
  isValid: boolean;
  sanitized: string;
  error?: string;
}

export function validateDisplayName(name: string | null | undefined): DisplayNameValidationResult {
  const sanitized = sanitizeDisplayName(name);

  if (!sanitized || sanitized.length === 0) {
    return {
      isValid: false,
      sanitized: "",
      error: "Display name cannot be empty or contain only whitespace.",
    };
  }

  if (sanitized.length < MIN_DISPLAY_NAME_LENGTH) {
    return {
      isValid: false,
      sanitized,
      error: `Display name must be at least ${MIN_DISPLAY_NAME_LENGTH} characters long.`,
    };
  }

  if (sanitized.length > MAX_DISPLAY_NAME_LENGTH) {
    return {
      isValid: false,
      sanitized,
      error: `Display name cannot exceed ${MAX_DISPLAY_NAME_LENGTH} characters.`,
    };
  }

  return {
    isValid: true,
    sanitized,
  };
}

export function sanitizeUsername(username: string | null | undefined): string {
  if (!username) return "";
  return username
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_.-]/g, "");
}

export interface UsernameValidationResult {
  isValid: boolean;
  sanitized: string;
  error?: string;
}

export function validateUsername(username: string | null | undefined): UsernameValidationResult {
  const sanitized = sanitizeUsername(username);

  if (!sanitized || sanitized.length === 0) {
    return {
      isValid: false,
      sanitized: "",
      error: "Username cannot be empty.",
    };
  }

  if (sanitized.length < MIN_USERNAME_LENGTH) {
    return {
      isValid: false,
      sanitized,
      error: `Username must be at least ${MIN_USERNAME_LENGTH} characters long.`,
    };
  }

  if (sanitized.length > MAX_USERNAME_LENGTH) {
    return {
      isValid: false,
      sanitized,
      error: `Username cannot exceed ${MAX_USERNAME_LENGTH} characters.`,
    };
  }

  if (!/^[a-z0-9][a-z0-9_.-]*[a-z0-9]$|^[a-z0-9]$/.test(sanitized)) {
    return {
      isValid: false,
      sanitized,
      error: "Username must start and end with an alphanumeric character.",
    };
  }

  return {
    isValid: true,
    sanitized,
  };
}
