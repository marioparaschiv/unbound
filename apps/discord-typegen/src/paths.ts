import Logger from '@unbound-app/logger';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const logger = Logger.create('Discord Typegen');

export const ROOT = join(__dirname, '..', '..', '..');
export const TYPES_DIR = join(ROOT, 'packages', 'types');
export const PACKAGE_DIR = join(ROOT, 'packages', 'discord-types');
export const OUT_DIR = join(PACKAGE_DIR, 'src');
export const README = join(PACKAGE_DIR, 'README.md');
export const CACHE_DIR = join(homedir(), '.cache', 'unbound');
