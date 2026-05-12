import { prisma } from '../db';
import { PlatformName } from '../types';
import { getRandomInt } from '../utils/random';

const normalize = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const upsertCounselor = async (
  name: string,
  description: string,
  aliases = '',
) => {
  return prisma.counselor.upsert({
    where: { name: name.trim() },
    update: {
      description: description.trim(),
      aliases: aliases.trim() || null,
      isActive: true,
    },
    create: {
      name: name.trim(),
      description: description.trim(),
      aliases: aliases.trim() || null,
      isActive: true,
    },
  });
};

export const startQuiz = async (
  platform: PlatformName,
  chatId: string,
  userId?: string,
): Promise<string> => {
  const counselors = await prisma.counselor.findMany({
    where: {
      isActive: true,
    },
  });

  if (!counselors.length) {
    return 'Для викторины пока не добавлены вожатые. Админ должен заполнить базу.';
  }

  const selected = counselors[getRandomInt(counselors.length)];

  await prisma.quizSession.upsert({
    where: {
      platform_chatId: {
        platform,
        chatId,
      },
    },
    update: {
      userId,
      counselorId: selected.id,
      attempts: 0,
      isActive: true,
    },
    create: {
      platform,
      chatId,
      userId,
      counselorId: selected.id,
      attempts: 0,
      isActive: true,
    },
  });

  return [
    'Викторина «Угадай вожатого»',
    '',
    `Описание: ${selected.description}`,
    '',
    'Напиши имя вожатого одним сообщением.',
  ].join('\n');
};

export const stopQuiz = async (
  platform: PlatformName,
  chatId: string,
): Promise<string> => {
  await prisma.quizSession.updateMany({
    where: {
      platform,
      chatId,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  return 'Викторина остановлена.';
};

export const processQuizAnswer = async (
  platform: PlatformName,
  chatId: string,
  answer: string,
): Promise<string | null> => {
  const session = await prisma.quizSession.findUnique({
    where: {
      platform_chatId: {
        platform,
        chatId,
      },
    },
    include: {
      counselor: true,
    },
  });

  if (!session || !session.isActive) {
    return null;
  }

  const accepted = [
    session.counselor.name,
    ...(session.counselor.aliases
      ? session.counselor.aliases.split(',').map((item) => item.trim()).filter(Boolean)
      : []),
  ].map(normalize);

  const userAnswer = normalize(answer);
  const isCorrect = accepted.includes(userAnswer);

  if (isCorrect) {
    await prisma.quizSession.update({
      where: {
        platform_chatId: {
          platform,
          chatId,
        },
      },
      data: {
        isActive: false,
      },
    });

    return `Верно! Это ${session.counselor.name}.`;
  }

  const nextAttempts = session.attempts + 1;

  if (nextAttempts >= 4) {
    await prisma.quizSession.update({
      where: {
        platform_chatId: {
          platform,
          chatId,
        },
      },
      data: {
        attempts: nextAttempts,
        isActive: false,
      },
    });

    return `Не угадали. Это был ${session.counselor.name}. Запусти новую игру командой «угадай вожатого».`;
  }

  await prisma.quizSession.update({
    where: {
      platform_chatId: {
        platform,
        chatId,
      },
    },
    data: {
      attempts: nextAttempts,
    },
  });

  if (nextAttempts === 2) {
    const firstLetter = session.counselor.name.trim().charAt(0).toUpperCase();
    return `Пока нет. Подсказка: имя начинается на «${firstLetter}».`;
  }

  return 'Нет, попробуй ещё раз.';
};