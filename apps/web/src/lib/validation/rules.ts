/** Shared Ant Design `<Form rules>` helpers.
 *
 * Every user-facing form pulls from here so the phrasing, limits, and formats
 * stay in one place. Keep messages short, plain, and specific — say what the
 * user should do, not what the code checks for. Match the API-side DTOs
 * (`apps/api/src/**\/dto`) so the client rejects the same shapes before a
 * request leaves the browser. */

import type { Rule } from 'antd/es/form';

/* -------------------------------------------------------------------------- */
/* Constants — kept in sync with the API DTOs.                                */
/* -------------------------------------------------------------------------- */

/** 8–20 chars, digits with an optional leading `+` and inline `-`/space
 * separators — matches the `Matches(/^\+?[0-9\s-]{8,20}$/)` on `RegisterDto`. */
export const PHONE_PATTERN = /^\+?[0-9\s-]{8,20}$/;
/** Loose http(s) URL. Anchored so a leading `mailto:` won't sneak past. */
export const URL_PATTERN = /^https?:\/\/[^\s]+$/;

export const NAME_MAX = 80;
export const EMAIL_MAX = 255;
export const PHONE_MAX = 20;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

/* -------------------------------------------------------------------------- */
/* Building blocks.                                                           */
/* -------------------------------------------------------------------------- */

/** Trim-aware "required" — rejects an all-whitespace string, which the plain
 * `required: true` rule accepts. */
function requiredText(message: string): Rule {
  return {
    validator(_, value) {
      const text = typeof value === 'string' ? value.trim() : value;
      if (text === undefined || text === null || text === '') {
        return Promise.reject(new Error(message));
      }
      return Promise.resolve();
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Field rulesets.                                                            */
/* -------------------------------------------------------------------------- */

export function nameRules(label = 'Name'): Rule[] {
  return [
    requiredText(`${label} is required`),
    { max: NAME_MAX, message: `${label} must be ${NAME_MAX} characters or fewer` },
  ];
}

/** Required first/last name half of a two-column row where "Required" is
 * implied by the section header. */
export function shortNameRules(label: string): Rule[] {
  return [
    requiredText(`Enter a ${label.toLowerCase()}`),
    { max: NAME_MAX, message: `Keep it under ${NAME_MAX} characters` },
  ];
}

export function phoneRules({ required = true }: { required?: boolean } = {}): Rule[] {
  const rules: Rule[] = [
    {
      pattern: PHONE_PATTERN,
      message: 'Enter a valid mobile number (8–20 digits, e.g. +1 555 000 0000)',
    },
    { max: PHONE_MAX, message: `Mobile number must be ${PHONE_MAX} characters or fewer` },
  ];
  if (required) rules.unshift(requiredText('Mobile number is required'));
  return rules;
}

export function emailRules({ required = false }: { required?: boolean } = {}): Rule[] {
  const rules: Rule[] = [
    { type: 'email', message: "That doesn't look like an email address" },
    { max: EMAIL_MAX, message: `Email must be ${EMAIL_MAX} characters or fewer` },
  ];
  if (required) rules.unshift(requiredText('Email is required'));
  return rules;
}

export function passwordRules({ label = 'Password' }: { label?: string } = {}): Rule[] {
  return [
    requiredText(`${label} is required`),
    { min: PASSWORD_MIN, message: `${label} must be at least ${PASSWORD_MIN} characters` },
    { max: PASSWORD_MAX, message: `${label} must be ${PASSWORD_MAX} characters or fewer` },
  ];
}

/** Confirm-password rule — pair with `dependencies={[matchField]}`. */
export function confirmPasswordRule(matchField: string, label = 'Passwords'): Rule {
  return ({ getFieldValue }) => ({
    validator(_, value) {
      if (!value || value === getFieldValue(matchField)) return Promise.resolve();
      return Promise.reject(new Error(`${label} do not match`));
    },
  });
}

export function urlRules(label = 'Link'): Rule[] {
  return [{ pattern: URL_PATTERN, message: `${label} must start with http:// or https://` }];
}

export function requiredSelectRule(label: string): Rule {
  return {
    validator(_, value) {
      if (value === undefined || value === null || value === '') {
        return Promise.reject(new Error(`Pick a ${label.toLowerCase()}`));
      }
      if (Array.isArray(value) && value.length === 0) {
        return Promise.reject(new Error(`Pick at least one ${label.toLowerCase()}`));
      }
      return Promise.resolve();
    },
  };
}

/** For `<InputNumber>` amounts. `allowZero` lets a planned-budget line be 0 —
 * every other money field wants strictly positive. */
export function amountRules({
  label = 'Amount',
  allowZero = false,
}: {
  label?: string;
  allowZero?: boolean;
} = {}): Rule[] {
  return [
    {
      validator(_, value) {
        if (value === null || value === undefined || value === '') {
          return Promise.reject(new Error(`${label} is required`));
        }
        const num = typeof value === 'number' ? value : Number(value);
        if (Number.isNaN(num)) {
          return Promise.reject(new Error(`Enter a number for ${label.toLowerCase()}`));
        }
        if (allowZero ? num < 0 : num <= 0) {
          return Promise.reject(
            new Error(
              allowZero ? `${label} can't be negative` : `${label} must be greater than zero`,
            ),
          );
        }
        return Promise.resolve();
      },
    },
  ];
}

/** For a plain text field with a required minimum and a maxLength cap. */
export function textFieldRules({
  label,
  required = true,
  max,
}: {
  label: string;
  required?: boolean;
  max?: number;
}): Rule[] {
  const rules: Rule[] = [];
  if (required) rules.push(requiredText(`${label} is required`));
  if (max !== undefined) {
    rules.push({ max, message: `${label} must be ${max} characters or fewer` });
  }
  return rules;
}

/** Rejects a date string that is in the past (day-precision comparison). Pair
 * with a native `type="date"` or an antd DatePicker's ISO date value. */
export function notPastDateRule(label = 'Date'): Rule {
  return {
    validator(_, value) {
      if (!value) return Promise.resolve();
      const date = new Date(typeof value === 'string' ? value : String(value));
      if (Number.isNaN(date.getTime())) {
        return Promise.reject(new Error(`Enter a valid ${label.toLowerCase()}`));
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) {
        return Promise.reject(new Error(`${label} can't be in the past`));
      }
      return Promise.resolve();
    },
  };
}
