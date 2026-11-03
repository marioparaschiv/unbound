import type { Plugin } from 'rolldown';
import { cp } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * @description Copies the client's static files (`assets/`) into the build output, so they publish with the bundle.
 * @param root The client package root.
 * @returns A rolldown plugin copying them after the bundle is written.
 */
export default function staticAssets(root: string): Plugin {
	return {
		name: 'static-assets',
		async writeBundle() {
			await cp(join(root, 'assets'), join(root, 'dist'), { recursive: true });
		},
	};
}
