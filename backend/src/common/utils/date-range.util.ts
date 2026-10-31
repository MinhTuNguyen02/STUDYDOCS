import { BadRequestException } from '@nestjs/common';

export function assertChronologicalDateRange(startDate?: string, endDate?: string): void {
  if (startDate && endDate && startDate > endDate) {
    throw new BadRequestException('startDate must be before or equal to endDate.');
  }
}

export function currentDateInTimeZone(timeZone = 'Asia/Ho_Chi_Minh'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}
