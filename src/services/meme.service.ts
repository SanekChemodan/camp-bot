import { promises as fs } from 'fs';
import path from 'path';
import { config } from '../config';
import { getRandomInt } from '../utils/random';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

export const getRandomMemePath = async (): Promise<string> => {
  const dir = path.resolve(config.memeDir);
  const files = await fs.readdir(dir);

  const memeFiles = files.filter((file) =>
    ALLOWED_EXTENSIONS.has(path.extname(file).toLowerCase()),
  );

  if (!memeFiles.length) {
    throw new Error(`В папке ${dir} нет мемов.`);
  }

  const chosen = memeFiles[getRandomInt(memeFiles.length)];
  return path.join(dir, chosen);
};