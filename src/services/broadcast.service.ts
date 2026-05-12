import { buildDailyDigest } from './content.service';
import { getActiveSubscribers, markSubscriberInactive } from './subscriber.service';
import { SenderMap } from '../types';

export const sendDailyBroadcast = async (senders: SenderMap): Promise<number> => {
  const text = await buildDailyDigest();
  const subscribers = await getActiveSubscribers();

  for (const subscriber of subscribers) {
    try {
      await senders[subscriber.platform as keyof SenderMap].sendText(
        subscriber.chatId,
        text,
      );
    } catch (error) {
      console.error(
        `[broadcast] failed for ${subscriber.platform}:${subscriber.chatId}`,
        error,
      );
      await markSubscriberInactive(
        subscriber.platform as keyof SenderMap,
        subscriber.chatId,
      );
    }
  }

  return subscribers.length;
};