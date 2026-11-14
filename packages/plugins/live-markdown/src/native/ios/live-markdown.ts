import type { NativeBridge } from '@unbound-app/api/native';

import { installComposerMarkdown, restoreComposerMarkdown } from '~/native/ios/composer';

/**
 * @description Draws markdown in the composer on iOS until disposed.
 * @param native The plugin's native bridge.
 * @returns `dispose`, which puts the composer text back to plain styling and removes the hooks.
 */
export function liveMarkdownIOS(native: NativeBridge) {
	const scope = native.ui.createScope();

	native.ui.run(installComposerMarkdown, scope);

	return {
		dispose() {
			native.ui.run(restoreComposerMarkdown);
			scope.dispose();
		},
	};
}
