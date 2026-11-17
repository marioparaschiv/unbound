import type { NativeBridge } from '@unbound-app/api/native';

import coverage from '~/lib/coverage.json';
import type { PackId } from '~/lib/packs';
import { installEmojiPack, setEmojiPack } from '~/native/android/worklets';

const EMOJI_MODEL_SHAPE = {
	methods: [
		{ name: 'a', parameters: [], returns: 'java.lang.String' },
		{ name: 'b', parameters: ['int', 'boolean'], returns: 'java.lang.String' },
	],
	fields: [{ type: 'java.lang.String', static: false }],
	limit: 8,
};

/**
 * @description Draws unicode emoji from a pack on Android, through the URL method of Discord's emoji models.
 * @param native The plugin's native bridge.
 * @param pack Reads the chosen pack.
 * @returns `refresh`, which applies a changed pack, and `dispose`, which removes the hooks.
 */
export function packsAndroid(native: NativeBridge, pack: () => PackId) {
	const scope = native.ui.createScope();
	let disposed = false;

	native.java
		.findClasses(EMOJI_MODEL_SHAPE)
		.then((classes) => {
			if (disposed) return;

			if (classes.length === 0) {
				logger.warn('Failed to find the emoji models: no class matched');

				return;
			}

			native.ui.run(installEmojiPack, scope, classes, pack(), coverage);
		})
		.catch((error: unknown) => logger.error('Failed to find the emoji models:', error));

	return {
		refresh() {
			native.ui.run(setEmojiPack, pack());
		},
		dispose() {
			disposed = true;
			scope.dispose();
		},
	};
}
