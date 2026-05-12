import { DateTime } from 'luxon';
import { config } from '../config';

export const todayDateString = (): string => {
  return DateTime.now().setZone(config.botTimezone).toFormat('yyyy-LL-dd');
};

export const parseDateInput = (raw?: string): string | null => {
  if (!raw || !raw.trim()) {
    return todayDateString();
  }

  const value = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const dt = DateTime.fromFormat(value, 'yyyy-LL-dd', { zone: config.botTimezone });
  return dt.isValid ? value : null;
};

export const parseDateTimeInput = (raw: string): Date | null => {
  const dt = DateTime.fromFormat(raw.trim(), 'yyyy-LL-dd HH:mm', {
    zone: config.botTimezone,
  });

  if (!dt.isValid) {
    return null;
  }

  return dt.toJSDate();
};

export const formatDateTime = (date: Date): string => {
  return DateTime.fromJSDate(date).setZone(config.botTimezone).toFormat('dd.LL.yyyy HH:mm');
};

export const formatCountdown = (targetDate: Date): string => {
  const now = DateTime.now().setZone(config.botTimezone);
  const target = DateTime.fromJSDate(targetDate).setZone(config.botTimezone);

  if (target <= now) {
    return 'событие уже началось';
  }

  const diff = target.diff(now, ['days', 'hours', 'minutes']).toObject();

  const days = Math.floor(diff.days ?? 0);
  const hours = Math.floor(diff.hours ?? 0);
  const minutes = Math.ceil(diff.minutes ?? 0);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} дн.`);
  if (hours > 0) parts.push(`${hours} ч.`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} мин.`);

  return parts.join(' ');
};