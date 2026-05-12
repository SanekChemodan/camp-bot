import { prisma } from '../db';
import { PlatformName } from '../types';

type RegisterSubscriberInput = {
  platform: PlatformName;
  chatId: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
};

export const registerSubscriber = async (input: RegisterSubscriberInput) => {
  return prisma.subscriber.upsert({
    where: {
      platform_chatId: {
        platform: input.platform,
        chatId: input.chatId,
      },
    },
    update: {
      userId: input.userId,
      firstName: input.firstName,
      lastName: input.lastName,
      username: input.username,
    },
    create: {
      platform: input.platform,
      chatId: input.chatId,
      userId: input.userId,
      firstName: input.firstName,
      lastName: input.lastName,
      username: input.username,
      isActive: true,
    },
  });
};

export const setSubscriptionState = async (
  platform: PlatformName,
  chatId: string,
  isActive: boolean,
) => {
  return prisma.subscriber.upsert({
    where: {
      platform_chatId: {
        platform,
        chatId,
      },
    },
    update: {
      isActive,
    },
    create: {
      platform,
      chatId,
      isActive,
    },
  });
};

export const markSubscriberInactive = async (platform: PlatformName, chatId: string) => {
  return prisma.subscriber.updateMany({
    where: {
      platform,
      chatId,
    },
    data: {
      isActive: false,
    },
  });
};

export const getActiveSubscribers = async () => {
  return prisma.subscriber.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      id: 'asc',
    },
  });
};