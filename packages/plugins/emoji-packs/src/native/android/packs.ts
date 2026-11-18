import type { NativeBridge } from '@unbound-app/api/native';

import coverage from '~/lib/coverage.json';
import type { PackId } from '~/lib/packs';
import { installEmojiPack, installPickerEmojiPack, setEmojiPack } from '~/native/android/worklets';
import { findAssetMethod } from '~/native/android/asset-method';
import {
	installComposerPack,
	restoreComposerPack,
	setComposerPack,
	takeComposerImages,
} from '~/native/android/composer';
import { feedComposerImages } from '~/lib/composer-images';

const SEARCH_ATTEMPTS = 4;
const SEARCH_RETRY_MS = 2000;

const EMOJI_MODEL_SHAPE = {
	methods: [
		{ name: 'a', parameters: [], returns: 'java.lang.String' },
		{ name: 'b', parameters: ['int', 'boolean'], returns: 'java.lang.String' },
	],
	fields: [{ type: 'java.lang.String', static: false }],
	limit: 8,
};

/**
 * @description Draws unicode emoji from a pack on Android: in chat through the URL method of Discord's emoji models, in
 * the emoji picker through the method that builds their bundled image URL, and in the chat input with image spans.
 * @param native The plugin's native bridge.
 * @param pack Reads the chosen pack.
 * @returns `refresh`, which applies a changed pack, and `dispose`, which removes the hooks.
 */
export function packsAndroid(native: NativeBridge, pack: () => PackId) {
	const scope = native.ui.createScope();
	let disposed = false;
	let retry: ReturnType<typeof setTimeout> | undefined;

	function install(attempt: number) {
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
			.catch((error: unknown) => {
				if (disposed) return;

				if (attempt >= SEARCH_ATTEMPTS) {
					logger.error('Failed to find the emoji models:', error);

					return;
				}

				retry = setTimeout(() => install(attempt + 1), SEARCH_RETRY_MS * attempt);
			});
	}

	install(1);

	findAssetMethod(native.java)
		.then((found) => {
			if (disposed) return;

			if (!found) {
				logger.warn('Emoji picker keeps Discord’s emoji: found no emoji asset method.');

				return;
			}

			native.ui.run(installPickerEmojiPack, scope, found.className, found.method);
		})
		.catch((error: unknown) => logger.error('Failed to find the emoji asset method:', error));

	native.ui.run(installComposerPack, scope, pack(), coverage);

	const stopFeeding = feedComposerImages((files) => native.ui.call(takeComposerImages, files));

	return {
		refresh() {
			native.ui.run(setEmojiPack, pack());
			native.ui.run(setComposerPack, pack());
		},
		dispose() {
			disposed = true;
			clearTimeout(retry);
			stopFeeding();
			native.ui.run(restoreComposerPack);
			scope.dispose();
		},
	};
}
