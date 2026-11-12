import type { AnyProps } from '@unbound-app/api/metro';
import { patcher } from '@unbound-app/api';

import { expressionSheets } from '~/patches/expression-sheets';
import { ActionSheets } from '~/lib/modules';
import { getSheetKind } from '~/lib/expression';

/**
 * @description Adds the Copy URL, Copy markup, Favorite and Clone buttons to emoji and sticker sheets: watches `openLazy`
 * for them, and patches each sheet's component once it loads.
 */
export function patchActionSheets(): void {
	if (!ActionSheets) {
		logger.warn('Expression sheets skipped: Discord moved ActionSheets.');

		return;
	}

	const sheets = expressionSheets();

	patcher.before(ActionSheets, 'openLazy', ({ args: [load, key] }) => {
		if (typeof key !== 'string' || !load?.then) return;

		const kind = getSheetKind(key);

		if (!kind) return;

		load.then((module?: AnyProps) => {
			if (module && typeof module === 'object')
				sheets.patchExpressionSheet(module, kind, key);
		}).catch(() => undefined);
	});
}
