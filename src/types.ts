export type PlatformName = 'telegram' | 'vk';

export type PlatformSender = {
    sendText: (chatId: string, text: string) => Promise<void>;
    sendPhoto: (chatId: string, filePath: string, caption?: string) => Promise<void>;
};

export type SenderMap = Record<PlatformName, PlatformSender>;