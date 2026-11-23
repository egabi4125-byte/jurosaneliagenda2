import type { Closure } from '../types';

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(value) ? value : 0);
}

export function getTodayDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateToStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

export function addDays(dateStr: string, days: number): string {
  const dt = parseDateStr(dateStr);
  dt.setDate(dt.getDate() + days);
  return formatDateToStr(dt);
}

export function formatDateBR(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateLongBR(dateStr: string): string {
  if (!dateStr) return '';
  const dt = parseDateStr(dateStr);
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(dt);
}

export function formatMonthYearBR(year: number, monthIndex: number): string {
  const dt = new Date(year, monthIndex, 1);
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(dt);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function buildSlotId(dateStr: string, timeStr: string): string {
  return `${dateStr}_${timeStr.replace(':', '-')}`;
}

export function buildLockId(clientId: string, dateStr: string): string {
  return `${clientId}_${dateStr}`;
}

export function getAppointmentDateTime(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
}

export function isSlotInPast(dateStr: string, timeStr: string): boolean {
  const slotDt = getAppointmentDateTime(dateStr, timeStr);
  return slotDt.getTime() <= Date.now();
}

export function isDateFullyPast(dateStr: string): boolean {
  return dateStr < getTodayDateStr();
}

export function getHoursUntilAppointment(dateStr: string, timeStr: string): number {
  const dt = getAppointmentDateTime(dateStr, timeStr);
  return (dt.getTime() - Date.now()) / (1000 * 60 * 60);
}

export function isFreeCancellationWindow(dateStr: string, timeStr: string): boolean {
  return getHoursUntilAppointment(dateStr, timeStr) >= 2;
}

export function formatPhoneMask(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function cleanPhoneForWhatsApp(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function buildWhatsAppUrl(phone: string, message?: string): string {
  const number = cleanPhoneForWhatsApp(phone);
  const base = number ? `https://wa.me/${number}` : 'https://wa.me/';
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

export function buildMapsUrlFromAddress(address: string): string {
  const trimmed = (address || '').trim();
  if (!trimmed) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
}

export function normalizeInstagramUrl(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const handle = trimmed.replace(/^@+/, '').replace(/^instagram\.com\//i, '').replace(/\/+$/, '');
  return handle ? `https://instagram.com/${handle}` : '';
}

export function isDayClosedByClosures(dateStr: string, closures: Closure[]): Closure | undefined {
  return closures.find(
    (c) =>
      c.active &&
      (c.type === 'day' || c.type === 'week') &&
      dateStr >= c.startDate &&
      dateStr <= c.endDate
  );
}

export function isSlotClosedByClosures(
  dateStr: string,
  timeStr: string,
  closures: Closure[]
): Closure | undefined {
  return closures.find((c) => {
    if (!c.active) return false;
    if (c.type === 'day' || c.type === 'week') {
      return dateStr >= c.startDate && dateStr <= c.endDate;
    }
    if (c.type === 'slot') {
      return c.startDate === dateStr && c.time === timeStr;
    }
    return false;
  });
}

export interface CalendarCell {
  dateStr: string;
  dayNumber: number;
  inCurrentMonth: boolean;
}

export function getMonthGrid(year: number, monthIndex: number): CalendarCell[] {
  const firstDay = new Date(year, monthIndex, 1);
  const startWeekday = firstDay.getDay(); // 0 = Sun
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const cells: CalendarCell[] = [];

  // Leading days from previous month
  for (let i = startWeekday - 1; i >= 0; i--) {
    const dt = new Date(year, monthIndex, -i);
    cells.push({
      dateStr: formatDateToStr(dt),
      dayNumber: dt.getDate(),
      inCurrentMonth: false,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, monthIndex, d);
    cells.push({
      dateStr: formatDateToStr(dt),
      dayNumber: d,
      inCurrentMonth: true,
    });
  }

  // Trailing days to fill complete weeks (35 or 42)
  const remainder = cells.length % 7;
  if (remainder > 0) {
    const needed = 7 - remainder;
    for (let d = 1; d <= needed; d++) {
      const dt = new Date(year, monthIndex + 1, d);
      cells.push({
        dateStr: formatDateToStr(dt),
        dayNumber: d,
        inCurrentMonth: false,
      });
    }
  }

  return cells;
}

export function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}
