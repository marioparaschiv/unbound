import { MESSAGE_TEXT_VIEW_CLASSES } from '@unbound-plugins/shared/native/ios/text-attachments';
import { createFontHost } from '@unbound-plugins/shared/native/fonts/ios/font-host';
import type { NativeBridge } from '@unbound-app/api/native';

import type { ScriptChoices } from '~/lib/choices';
import type { ScriptId } from '~/lib/scripts';
import type { FontFallbackSession } from '~/native/font-fallback';
import { installFontFallback, restoreFontFallback, setFontFallback } from '~/native/ios/worklets';
import { facePaths } from '~/native/face-paths';

async function registeredNames(native: NativeBridge, choices: ScriptChoices) {
	const host = createFontHost(native);
	const names: Partial<Record<ScriptId, string>> = {};

	for (const [script, path] of Object.entries(facePaths(choices)) as [ScriptId, string][]) {
		try {
			names[script] = await host.register(path, script);
		} catch (error) {
			logger.error(`Failed to load the ${script} font ${path}:`, error);
		}
	}

	return names;
}

/**
 * @description Draws each script in message text with its font on iOS, registering the picked faces with Core Text.
 * @param native The plugin's native bridge.
 * @param choices The face picked for each script.
 * @returns `update`, which changes the fonts, and `dispose`, which puts the original text back.
 */
export function fontFallbackIOS(native: NativeBridge, choices: ScriptChoices): FontFallbackSession {
	const scope = native.ui.createScope();
	const installed = registeredNames(native, choices).then((names) =>
		native.ui.run(installFontFallback, scope, [...MESSAGE_TEXT_VIEW_CLASSES], names),
	);

	return {
		async update(next) {
			await installed;
			native.ui.run(setFontFallback, await registeredNames(native, next));
		},
		dispose() {
			void installed.then(() => {
				native.ui.run(restoreFontFallback);
				scope.dispose();
			});
		},
	};
}
