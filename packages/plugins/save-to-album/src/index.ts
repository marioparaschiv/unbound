import type { PluginContext } from '@unbound-app/api/native';
import { settings } from '@unbound-app/settings';
import { metro, patcher } from '@unbound-app/api';

import { askToRead, canRead, fileNewest } from '~/native/album';

type MediaManager = { downloadMediaAsset: (...args: unknown[]) => unknown };

const SETTLE_MS = 600;

async function fileSaved(context: PluginContext, since: number) {
	if (!canRead(context.native) && !(await askToRead(context.native))) {
		logger.warn('Saved item left out of the album: Photos access was not granted.');

		return;
	}

	await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

	const album = settings.album.trim() || 'Discord';

	if (!fileNewest(context.native, album, since)) {
		logger.warn(`Found no newly saved item to put in the ${album} album.`);
	}
}

function afterSave(context: PluginContext, since: number, result: unknown) {
	const done = result instanceof Promise ? result : Promise.resolve(result);

	void done
		.then(() => fileSaved(context, since))
		.catch((error: unknown) =>
			logger.error('Failed to put a saved item into its album:', error),
		);
}

export function start(context: PluginContext) {
	metro.onModuleLoaded(metro.filters.byProps('downloadMediaAsset'), (manager: MediaManager) => {
		patcher.after(manager, 'downloadMediaAsset', ({ result }) => {
			afterSave(context, Date.now(), result);

			return result;
		});
	});
}

export function stop() {
	patcher.unpatchAll();
}
