import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';

export interface FieldValidationError {
  field: string;
  messages: string[];
}

function flattenValidationErrors(
  errors: ValidationError[],
  parent = ''
): FieldValidationError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const current = error.constraints
      ? [{ field, messages: Object.values(error.constraints) }]
      : [];
    return [...current, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    message: 'Dữ liệu không hợp lệ.',
    errors: flattenValidationErrors(errors)
  });
}
