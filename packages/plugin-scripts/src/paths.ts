import { resolve } from 'node:path';

export const REPO_ROOT = resolve(import.meta.dir, '../../..');
export const PLUGINS_DIR = resolve(REPO_ROOT, 'packages/plugins');
export const PLUGIN_ICONS_DIR = resolve(REPO_ROOT, 'assets/plugins/icons');
