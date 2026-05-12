import { prisma } from '../db';
import { config } from '../config';
import {
  formatCountdown,
  formatDateTime,
  parseDateTimeInput,
  todayDateString,
} from '../utils/date';

const assertHttpUrl = (url: string) => {
  if (!/^https?:\/\/\S+$/i.test(url.trim())) {
    throw new Error('Ссылка должна начинаться с http:// или https://');
  }
};

export const upsertSchedule = async (date: string, text: string) => {
  return prisma.scheduleDay.upsert({
    where: { date },
    update: { text: text.trim() },
    create: { date, text: text.trim() },
  });
};

export const getScheduleText = async (date = todayDateString()): Promise<string> => {
  const row = await prisma.scheduleDay.findUnique({
    where: { date },
  });

  if (!row) {
    return `Расписание на ${date}:\nПока не заполнено.`;
  }

  return `Расписание на ${date}:\n${row.text}`;
};

export const upsertFood = async (
  date: string,
  breakfast: string,
  lunch: string,
  dinner: string,
) => {
  return prisma.dayMenu.upsert({
    where: { date },
    update: {
      breakfast: breakfast.trim(),
      lunch: lunch.trim(),
      dinner: dinner.trim(),
    },
    create: {
      date,
      breakfast: breakfast.trim(),
      lunch: lunch.trim(),
      dinner: dinner.trim(),
    },
  });
};

export const getFoodText = async (date = todayDateString()): Promise<string> => {
  const row = await prisma.dayMenu.findUnique({
    where: { date },
  });

  if (!row) {
    return `Еда на ${date}:\nЗавтрак: не заполнено\nОбед: не заполнено\nУжин: не заполнено`;
  }

  return [
    `Еда на ${date}:`,
    `Завтрак: ${row.breakfast}`,
    `Обед: ${row.lunch}`,
    `Ужин: ${row.dinner}`,
  ].join('\n');
};

export const upsertSocialLink = async (title: string, url: string) => {
  assertHttpUrl(url);

  return prisma.socialLink.upsert({
    where: { title },
    update: { url: url.trim() },
    create: { title: title.trim(), url: url.trim() },
  });
};

export const getSocialsText = async (): Promise<string> => {
  const rows = await prisma.socialLink.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });

  if (!rows.length) {
    return 'Соцсети пока не добавлены.';
  }

  return `Соцсети:\n${rows.map((row) => `- ${row.title}: ${row.url}`).join('\n')}`;
};

export const upsertAlbumLink = async (title: string, url: string) => {
  assertHttpUrl(url);

  return prisma.albumLink.upsert({
    where: { title },
    update: { url: url.trim() },
    create: { title: title.trim(), url: url.trim() },
  });
};

export const getAlbumsText = async (): Promise<string> => {
  const rows = await prisma.albumLink.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });

  if (!rows.length) {
    return 'Альбомы смены пока не добавлены.';
  }

  return `Альбом смены:\n${rows.map((row) => `- ${row.title}: ${row.url}`).join('\n')}`;
};

export const archiveExpiredTimers = async () => {
  await prisma.timerEvent.updateMany({
    where: {
      isActive: true,
      eventAt: {
        lt: new Date(),
      },
    },
    data: {
      isActive: false,
    },
  });
};

export const upsertTimerEvent = async (title: string, dateTimeRaw: string) => {
  const eventAt = parseDateTimeInput(dateTimeRaw);
  if (!eventAt) {
    throw new Error('Дата должна быть в формате YYYY-MM-DD HH:mm');
  }

  return prisma.timerEvent.upsert({
    where: {
      title: title.trim(),
    },
    update: {
      eventAt,
      isActive: true,
    },
    create: {
      title: title.trim(),
      eventAt,
      isActive: true,
    },
  });
};

export const getTimersText = async (query = ''): Promise<string> => {
  await archiveExpiredTimers();

  const rows = await prisma.timerEvent.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      eventAt: 'asc',
    },
  });

  const filtered = query.trim()
    ? rows.filter((row) =>
        row.title.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : rows;

  if (!filtered.length) {
    return 'Активных таймеров нет.';
  }

  const lines = filtered.map((row) => {
    return `- ${row.title}: ${formatCountdown(row.eventAt)} (до ${formatDateTime(row.eventAt)})`;
  });

  return `Таймеры:\n${lines.join('\n')}`;
};

export const buildDailyDigest = async (date = todayDateString()): Promise<string> => {
  const schedule = await getScheduleText(date);
  const food = await getFoodText(date);

  return [
    `${config.campName}`,
    `Утренняя рассылка на ${date}`,
    '',
    schedule,
    '',
    food,
  ].join('\n');
};