import { BadRequestException } from '@nestjs/common';

export function Number(value: string | number): number {
  try {
    return Number(value);
  } catch {
    throw new BadRequestException('ID không hợp lệ.');
  }
}
