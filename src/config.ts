import 'dotenv/config';
import process from 'node:process';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error('Не задана переменная окружения: ' + name);
  }
  return value;
};

const parseIdSet = (value?: string): Set<string> => {
  return new Set(
    (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
};

export const config = {
  telegramToken: required('TELEGRAM_BOT_TOKEN'),
  vkToken: required('VK_BOT_TOKEN'),
  vkGroupId: Number(required('VK_GROUP_ID')),
  openWeatherApiKey: required('OPENWEATHER_API_KEY'),

  campName: process.env.CAMP_NAME ?? 'Лагерь',
  campCity: process.env.CAMP_CITY ?? 'Москва',
  campLat: process.env.CAMP_LAT ? Number(process.env.CAMP_LAT) : null,
  campLon: process.env.CAMP_LON ? Number(process.env.CAMP_LON) : null,

  botTimezone: process.env.BOT_TIMEZONE ?? 'Europe/Moscow',
  memeDir: process.env.MEME_DIR ?? 'storage/memes',

  tgAdminIds: parseIdSet(process.env.TG_ADMIN_IDS),
  vkAdminIds: parseIdSet(process.env.VK_ADMIN_IDS),
};