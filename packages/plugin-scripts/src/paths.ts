import { resolve } from 'node:path';

export const REPO_ROOT = resolve(import.meta.dir, '../../..');
export const PLUGINS_DIR = resolve(REPO_ROOT, 'packages/plugins');
export const NON_PLUGIN_ADDON_DIRS = ['fonts', 'icon-packs', 'themes'].map((kind) =>
	resolve(REPO_ROOT, 'packages', kind),
);
export const PLUGIN_ICONS_DIR = resolve(REPO_ROOT, 'assets/plugins/icons');
export const PLUGIN_README_ICONS_DIR = resolve(REPO_ROOT, 'assets/plugins/readme-icons');
