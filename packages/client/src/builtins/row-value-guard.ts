import { createLogger } from '@unbound-app/logger';

import { watchRowShapes } from '~/builtins/row-shape-check.dev';
import { dropInvalidRowValues } from '~/core/row-values';
import { createPatcher } from '~/patcher/create-patcher';
import { onModuleLoaded } from '~/metro/wait';
import { byName } from '~/metro/filters';

const Patcher = createPatcher('unbound::row-value-guard');
const Logger = createLogger('RowValueGuard');

let stopWaiting: (() => void) | undefined;

function patchRowManager(RowManager: MetroExport) {
	if (typeof RowManager?.prototype?.generate !== 'function') {
		Logger.warn('Row value guard skipped: Discord moved RowManager.prototype.generate.');

		return;
	}

	if (import.meta.env.DEV_TOOLS) {
		watchRowShapes(Patcher, RowManager.prototype);
	}

	Patcher.after(
		RowManager.prototype,
		'generate',
		({ result }) => {
			const removed = dropInvalidRowValues(result);

			if (removed.length) {
				Logger.warn(
					`Removed ${removed.length} value(s) Discord cannot draw from a chat row:`,
					removed.map((value) => `${value.path} ${value.reason}`).join(', '),
				);
			}

			return result;
		},
		{ last: true },
	);
}

/**
 * @description Removes NaN, infinite and malformed colour values from chat rows after every plugin's patches ran,
 * before Discord's native code draws them.
 */
export function start() {
	stopWaiting = onModuleLoaded(byName('RowManager'), patchRowManager);
}

/**
 * @description Stops guarding chat row values.
 */
export function stop() {
	stopWaiting?.();
	stopWaiting = undefined;
	Patcher.unpatchAll();
}

export default { start, stop };
