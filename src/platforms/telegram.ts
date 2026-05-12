import { Input, Telegraf } from 'telegraf';
import { config } from '../config';
import { handleIncomingMessage } from '../core/command-handler';
import { MAIN_MENU_ROWS } from '../core/menu';
import { PlatformSender } from '../types';

const telegramReplyMarkup = {
  keyboard: MAIN_MENU_ROWS.map((row) => row.map((label) => ({ text: label }))),
  resize_keyboard: true,
  is_persistent: true,
};

export const startTelegramBot = async () => {
  const bot = new Telegraf(config.telegramToken);

  bot.catch((error, ctx) => {
    console.error('[telegram] unhandled error', {
      error,
      update: ctx.update,
    });
  });

  bot.on('text', async (ctx) => {
    try {
      await handleIncomingMessage({
        platform: 'telegram',
        chatId: String(ctx.chat.id),
        userId: String(ctx.from.id),
        text: ctx.message.text,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        username: ctx.from.username,
        replyText: async (text: string) => {
          await ctx.reply(text, {
            reply_markup: telegramReplyMarkup,
          });
        },
        replyPhoto: async (filePath: string, caption?: string) => {
          await ctx.replyWithPhoto(Input.fromLocalFile(filePath), {
            caption,
            reply_markup: telegramReplyMarkup,
          });
        },
      });
    } catch (error) {
      console.error('[telegram] handler error', {
        text: ctx.message.text,
        error,
      });

      await ctx.reply('Произошла ошибка при обработке команды.', {
        reply_markup: telegramReplyMarkup,
      });
    }
  });

  await bot.launch();
  console.log('[telegram] bot started');

  const sender: PlatformSender = {
    sendText: async (chatId, text) => {
      await bot.telegram.sendMessage(Number(chatId), text, {
        reply_markup: telegramReplyMarkup,
      });
    },
    sendPhoto: async (chatId, filePath, caption) => {
      await bot.telegram.sendPhoto(Number(chatId), Input.fromLocalFile(filePath), {
        caption,
        reply_markup: telegramReplyMarkup,
      });
    },
  };

  return { bot, sender };
};