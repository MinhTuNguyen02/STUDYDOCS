import { BadRequestException } from '@nestjs/common';

export function assertChronologicalDateRange(startDate?: string, endDate?: string): void {
  if (startDate && endDate && startDate > endDate) {
    throw new BadRequestException('startDate must be before or equal to endDate.');
  }
}
