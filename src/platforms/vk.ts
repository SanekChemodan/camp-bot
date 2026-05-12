import { Keyboard, VK } from 'vk-io';
import { config } from '../config';
import { handleIncomingMessage } from '../core/command-handler';
import { MAIN_MENU_ROWS } from '../core/menu';
import { PlatformSender } from '../types';
import { getRandomId } from '../utils/random';

const BUTTON_TO_COMMAND: Record<string, string> = {
  'Погода': 'weather',
  'Расписание': 'schedule',
  'Еда': 'food',
  'Таймер': 'timer',
  'Мем дня': 'meme',
  'Угадай вожатого': 'quiz',
  'Соцсети': 'socials',
  'Альбом смены': 'albums',
  'Сегодня': 'today',
  'Подписаться': 'subscribe',
  'Отписаться': 'unsubscribe',
  'Стоп': 'stop',
};

const createVkMenuKeyboard = () => {
  const builder = Keyboard.builder();

  MAIN_MENU_ROWS.forEach((row, rowIndex) => {
    row.forEach((label) => {
      builder.textButton({
        label,
        payload: {
          command: BUTTON_TO_COMMAND[label],
        },
        color: Keyboard.SECONDARY_COLOR,
      });
    });

    if (rowIndex < MAIN_MENU_ROWS.length - 1) {
      builder.row();
    }
  });

  return builder;
};

const payloadCommandToText = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const command = (payload as { command?: unknown }).command;
  if (typeof command !== 'string') {
    return null;
  }

  return command;
};

export const startVkBot = async () => {
  const vk = new VK({
    token: config.vkToken,
    pollingGroupId: config.vkGroupId,
  });

  const sendVkText = async (peerId: number, text: string) => {
    await vk.api.messages.send({
      peer_id: peerId,
      random_id: getRandomId(),
      message: text,
      keyboard: createVkMenuKeyboard(),
    });
  };

  const sendVkPhoto = async (peerId: number, filePath: string, caption?: string) => {
    const attachment = await vk.upload.messagePhoto({
      source: {
        value: filePath,
      },
    });

    await vk.api.messages.send({
      peer_id: peerId,
      random_id: getRandomId(),
      message: caption ?? '',
      attachment,
      keyboard: createVkMenuKeyboard(),
    });
  };

  vk.updates.on('message_new', async (context) => {
    try {
      if (context.isOutbox) return;

      const payloadText = payloadCommandToText(context.messagePayload);
      const incomingText = payloadText ?? context.text ?? '';

      if (!incomingText.trim()) return;

      await handleIncomingMessage({
        platform: 'vk',
        chatId: String(context.peerId),
        userId: String(context.senderId),
        text: incomingText,
        replyText: async (text: string) => {
          await sendVkText(context.peerId, text);
        },
        replyPhoto: async (filePath: string, caption?: string) => {
          await sendVkPhoto(context.peerId, filePath, caption);
        },
      });
    } catch (error) {
      console.error('[vk] handler error', {
        text: context.text,
        payload: context.messagePayload,
        error,
      });

      await sendVkText(context.peerId, 'Произошла ошибка при обработке команды.');
    }
  });

  vk.updates.startPolling().catch((error) => {
    console.error('[vk] polling error', error);
  });

  console.log('[vk] bot started');

  const sender: PlatformSender = {
    sendText: async (chatId, text) => {
      await sendVkText(Number(chatId), text);
    },
    sendPhoto: async (chatId, filePath, caption) => {
      await sendVkPhoto(Number(chatId), filePath, caption);
    },
  };

  return { vk, sender };
};