import { config } from '../config';
import { MAIN_MENU_ROWS, MENU_HINT } from './menu';
import { PlatformName } from '../types';
import { parseDateInput } from '../utils/date';
import {
  buildDailyDigest,
  getAlbumsText,
  getFoodText,
  getScheduleText,
  getSocialsText,
  getTimersText,
  upsertAlbumLink,
  upsertFood,
  upsertSchedule,
  upsertSocialLink,
  upsertTimerEvent,
} from '../services/content.service';
import { getRandomMemePath } from '../services/meme.service';
import {
  processQuizAnswer,
  startQuiz,
  stopQuiz,
  upsertCounselor,
} from '../services/quiz.service';
import {
  registerSubscriber,
  setSubscriptionState,
} from '../services/subscriber.service';
import { getWeatherText } from '../services/weather.service';

type IncomingContext = {
  platform: PlatformName;
  chatId: string;
  userId: string;
  text: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  replyText: (text: string) => Promise<void>;
  replyPhoto: (filePath: string, caption?: string) => Promise<void>;
};

type AppCommand =
  | 'help'
  | 'subscribe'
  | 'unsubscribe'
  | 'schedule'
  | 'food'
  | 'weather'
  | 'meme'
  | 'quiz'
  | 'stop'
  | 'timer'
  | 'socials'
  | 'albums'
  | 'today';

const COMMAND_ALIASES: Record<AppCommand, readonly string[]> = {
  help: ['start', 'help', 'помощь', 'меню'],
  subscribe: ['подписаться', 'subscribe'],
  unsubscribe: ['отписаться', 'unsubscribe'],
  schedule: ['расписание', 'schedule'],
  food: ['еда', 'food', 'меню питания'],
  weather: ['погода', 'weather'],
  meme: ['мем дня', 'мем', 'meme'],
  quiz: ['угадай вожатого', 'викторина', 'quiz'],
  stop: ['стоп', 'stop', 'отмена'],
  timer: ['таймер', 'timer'],
  socials: ['соцсети', 'соц сети', 'соц.сети', 'socials'],
  albums: ['альбом смены', 'альбом', 'album', 'albums'],
  today: ['сегодня', 'today'],
};

const normalizeText = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/@\w+/g, '')
    .replace(/^\/+/, '')
    .replace(/ё/g, 'е')
    .replace(/[!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const detectCommand = (
  rawText: string,
): { command: AppCommand; arg: string } | null => {
  const normalized = normalizeText(rawText);

  for (const [command, aliases] of Object.entries(COMMAND_ALIASES) as [
    AppCommand,
    readonly string[],
  ][]) {
    for (const alias of aliases) {
      if (normalized === alias) {
        return { command, arg: '' };
      }

      if (normalized.startsWith(alias + ' ')) {
        return {
          command,
          arg: normalized.slice(alias.length).trim(),
        };
      }
    }
  }

  return null;
};

const buildHelpText = (isAdmin: boolean): string => {
  const buttons = MAIN_MENU_ROWS.flat().map((item) => `- ${item}`).join('\n');

  const base = [
    'Доступные действия:',
    buttons,
    '',
    MENU_HINT,
  ].join('\n');

  if (!isAdmin) {
    return base;
  }

  return [
    base,
    '',
    'Админ-команды:',
    '/admin_schedule YYYY-MM-DD | текст расписания',
    '/admin_food YYYY-MM-DD | завтрак | обед | ужин',
    '/admin_social название | ссылка',
    '/admin_album название | ссылка',
    '/admin_counselor имя | описание | алиасы через запятую',
    '/admin_timer название | YYYY-MM-DD HH:mm',
  ].join('\n');
};

const isAdminUser = (platform: PlatformName, userId: string): boolean => {
  return platform === 'telegram'
    ? config.tgAdminIds.has(userId)
    : config.vkAdminIds.has(userId);
};

const cleanCommandText = (text: string): string => {
  return text.replace(/@\w+/g, '').trim();
};

const handleAdminCommand = async (
  ctx: IncomingContext,
  cleanText: string,
  isAdmin: boolean,
): Promise<boolean> => {
  if (!/^\/?admin_/i.test(cleanText)) {
    return false;
  }

  if (!isAdmin) {
    await ctx.replyText('Эта команда доступна только администраторам.');
    return true;
  }

  if (/^\/?admin_schedule\s+/i.test(cleanText)) {
    const payload = cleanText.replace(/^\/?admin_schedule\s+/i, '');
    const [datePart, ...rest] = payload.split('|');
    const date = datePart.trim();
    const text = rest.join('|').trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !text) {
      await ctx.replyText('Формат: /admin_schedule YYYY-MM-DD | текст расписания');
      return true;
    }

    await upsertSchedule(date, text);
    await ctx.replyText(`Расписание на ${date} сохранено.`);
    return true;
  }

  if (/^\/?admin_food\s+/i.test(cleanText)) {
    const payload = cleanText.replace(/^\/?admin_food\s+/i, '');
    const parts = payload.split('|').map((item) => item.trim());

    if (parts.length < 4) {
      await ctx.replyText('Формат: /admin_food YYYY-MM-DD | завтрак | обед | ужин');
      return true;
    }

    const [date, breakfast, lunch, dinner] = parts;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      await ctx.replyText('Дата должна быть в формате YYYY-MM-DD');
      return true;
    }

    await upsertFood(date, breakfast, lunch, dinner);
    await ctx.replyText(`Меню на ${date} сохранено.`);
    return true;
  }

  if (/^\/?admin_social\s+/i.test(cleanText)) {
    const payload = cleanText.replace(/^\/?admin_social\s+/i, '');
    const parts = payload.split('|').map((item) => item.trim());

    if (parts.length < 2) {
      await ctx.replyText('Формат: /admin_social название | ссылка');
      return true;
    }

    const [title, url] = parts;
    await upsertSocialLink(title, url);
    await ctx.replyText(`Соцсеть «${title}» сохранена.`);
    return true;
  }

  if (/^\/?admin_album\s+/i.test(cleanText)) {
    const payload = cleanText.replace(/^\/?admin_album\s+/i, '');
    const parts = payload.split('|').map((item) => item.trim());

    if (parts.length < 2) {
      await ctx.replyText('Формат: /admin_album название | ссылка');
      return true;
    }

    const [title, url] = parts;
    await upsertAlbumLink(title, url);
    await ctx.replyText(`Альбом «${title}» сохранён.`);
    return true;
  }

  if (/^\/?admin_counselor\s+/i.test(cleanText)) {
    const payload = cleanText.replace(/^\/?admin_counselor\s+/i, '');
    const parts = payload.split('|').map((item) => item.trim());

    if (parts.length < 2) {
      await ctx.replyText('Формат: /admin_counselor имя | описание | алиасы');
      return true;
    }

    const [name, description, aliases = ''] = parts;
    await upsertCounselor(name, description, aliases);
    await ctx.replyText(`Вожатый «${name}» сохранён.`);
    return true;
  }

  if (/^\/?admin_timer\s+/i.test(cleanText)) {
    const payload = cleanText.replace(/^\/?admin_timer\s+/i, '');
    const parts = payload.split('|').map((item) => item.trim());

    if (parts.length < 2) {
      await ctx.replyText('Формат: /admin_timer название | YYYY-MM-DD HH:mm');
      return true;
    }

    const [title, dateTime] = parts;
    await upsertTimerEvent(title, dateTime);
    await ctx.replyText(`Таймер «${title}» сохранён.`);
    return true;
  }

  await ctx.replyText('Неизвестная админ-команда.');
  return true;
};

export const handleIncomingMessage = async (ctx: IncomingContext): Promise<void> => {
  await registerSubscriber({
    platform: ctx.platform,
    chatId: ctx.chatId,
    userId: ctx.userId,
    firstName: ctx.firstName,
    lastName: ctx.lastName,
    username: ctx.username,
  });

  const rawText = cleanCommandText(ctx.text);
  const isAdmin = isAdminUser(ctx.platform, ctx.userId);

  if (!rawText) {
    return;
  }

  try {
    const handledAdmin = await handleAdminCommand(ctx, rawText, isAdmin);
    if (handledAdmin) {
      return;
    }

    const detected = detectCommand(rawText);

    if (detected?.command === 'help') {
      await ctx.replyText(buildHelpText(isAdmin));
      return;
    }

    if (detected?.command === 'subscribe') {
      await setSubscriptionState(ctx.platform, ctx.chatId, true);
      await ctx.replyText('Подписка на ежедневную рассылку включена.');
      return;
    }

    if (detected?.command === 'unsubscribe') {
      await setSubscriptionState(ctx.platform, ctx.chatId, false);
      await ctx.replyText('Ежедневная рассылка отключена.');
      return;
    }

    if (detected?.command === 'schedule') {
      const date = parseDateInput(detected.arg || undefined);

      if (detected.arg && !date) {
        await ctx.replyText('Дата должна быть в формате YYYY-MM-DD');
        return;
      }

      await ctx.replyText(await getScheduleText(date ?? undefined));
      return;
    }

    if (detected?.command === 'food') {
      const date = parseDateInput(detected.arg || undefined);

      if (detected.arg && !date) {
        await ctx.replyText('Дата должна быть в формате YYYY-MM-DD');
        return;
      }

      await ctx.replyText(await getFoodText(date ?? undefined));
      return;
    }

    if (detected?.command === 'weather') {
      await ctx.replyText(await getWeatherText());
      return;
    }

    if (detected?.command === 'meme') {
      const memePath = await getRandomMemePath();
      await ctx.replyPhoto(memePath, 'Мем дня');
      return;
    }

    if (detected?.command === 'quiz') {
      await ctx.replyText(await startQuiz(ctx.platform, ctx.chatId, ctx.userId));
      return;
    }

    if (detected?.command === 'stop') {
      await ctx.replyText(await stopQuiz(ctx.platform, ctx.chatId));
      return;
    }

    if (detected?.command === 'timer') {
      await ctx.replyText(await getTimersText(detected.arg));
      return;
    }

    if (detected?.command === 'socials') {
      await ctx.replyText(await getSocialsText());
      return;
    }

    if (detected?.command === 'albums') {
      await ctx.replyText(await getAlbumsText());
      return;
    }

    if (detected?.command === 'today') {
      await ctx.replyText(await buildDailyDigest());
      return;
    }

    const quizReply = await processQuizAnswer(ctx.platform, ctx.chatId, rawText);
    if (quizReply) {
      await ctx.replyText(quizReply);
      return;
    }

    await ctx.replyText(buildHelpText(isAdmin));
  } catch (error) {
    console.error('[handler] error', {
      platform: ctx.platform,
      chatId: ctx.chatId,
      userId: ctx.userId,
      text: rawText,
      error,
    });

    await ctx.replyText(
      'Команда не выполнилась.\nПроверь, что заполнены данные для этой функции, и попробуй ещё раз.',
    );
  }
};