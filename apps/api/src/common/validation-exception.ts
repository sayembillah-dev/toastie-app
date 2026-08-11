import type { ValidationError } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';

/** Flattens class-validator's per-property `ValidationError` tree into a flat
 * `{ propertyPath: message[] }` map so the client can route each message to
 * the form field it names, instead of only ever seeing the flat `message[]`
 * array Nest's default `exceptionFactory` produces. */
function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const error of errors) {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;
    if (error.constraints) {
      fields[path] = Object.values(error.constraints);
    }
    if (error.children?.length) {
      Object.assign(fields, flattenValidationErrors(error.children, path));
    }
  }
  return fields;
}

/** Drop-in replacement for `ValidationPipe`'s default `exceptionFactory`.
 * Keeps the flat `message: string[]` shape existing clients already read,
 * and adds `fields` alongside it so a form can call `form.setFields` with
 * the exact property each message belongs to. */
export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const fields = flattenValidationErrors(errors);
  const message = Object.values(fields).flat();
  return new BadRequestException({ statusCode: 400, error: 'Bad Request', message, fields });
}
