import { CronJob } from 'cron';
import { config } from './config';
import { sendDailyBroadcast } from './services/broadcast.service';
import { startTelegramBot } from './platforms/telegram';
import { startVkBot } from './platforms/vk';

const bootstrap = async () => {
  console.log('[bootstrap] starting telegram...');
  const telegram = await startTelegramBot();

  console.log('[bootstrap] starting vk...');
  const vk = await startVkBot();

  const senders = {
    telegram: telegram.sender,
    vk: vk.sender,
  };

  const dailyJob = new CronJob(
    '0 8 * * *',
    async () => {
      try {
        const count = await sendDailyBroadcast(senders);
        console.log(`[broadcast] sent to ${count} subscribers`);
      } catch (error) {
        console.error('[broadcast] failed', error);
      }
    },
    null,
    true,
    config.botTimezone,
  );

  dailyJob.start();

  console.log(`[bootstrap] ready. Daily broadcast: 08:00 (${config.botTimezone})`);
};

bootstrap().catch((error) => {
  console.error('[bootstrap] fatal error', error);
  process.exit(1);
});