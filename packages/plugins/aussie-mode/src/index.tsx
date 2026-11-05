import type { PluginContext } from '@unbound-app/api/native';

import { isAussieDevice } from '~/locale';
import { startRotation } from '~/rotation';
import { startUpsideDownText } from '~/text';

let stopRotation: () => Promise<void> = async () => {};

export async function start(context: PluginContext): Promise<void> {
	if (!isAussieDevice()) return;

	startUpsideDownText();
	stopRotation = await startRotation(context.native, (error) =>
		console.error('[Aussie Mode]', error),
	);
}

export async function stop(): Promise<void> {
	const cleanup = stopRotation;
	stopRotation = async () => {};
	await cleanup();
}
