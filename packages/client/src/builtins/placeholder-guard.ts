import { createLogger } from '@unbound-app/logger';

import { dropInvalidPlaceholders, type RowMessage } from '~/core/row-placeholders';
import { createPatcher } from '~/patcher/create-patcher';
import { onModuleLoaded } from '~/metro/wait';
import { byName } from '~/metro/filters';

const Patcher = createPatcher('unbound::placeholder-guard');
const Logger = createLogger('PlaceholderGuard');

type ChatRow = { message?: RowMessage };

let stopWaiting: (() => void) | undefined;

function patchRowManager(RowManager: MetroExport) {
	if (typeof RowManager?.prototype?.generate !== 'function') {
		Logger.warn('Placeholder guard skipped: Discord moved RowManager.prototype.generate.');

		return;
	}

	Patcher.after(RowManager.prototype, 'generate', ({ result }) => {
		const message = (result as ChatRow | undefined)?.message;
		const dropped = message ? dropInvalidPlaceholders(message) : 0;

		if (dropped) {
			Logger.warn(
				`Dropped ${dropped} malformed image placeholder(s) from message ${message?.id}.`,
			);
		}

		return result;
	});
}

/**
 * @description Strips malformed image placeholders from chat rows before Discord's native code decodes them, as a short
 * ThumbHash from a local edit or a plugin crashes Discord.
 */
export function start() {
	stopWaiting = onModuleLoaded(byName('RowManager'), patchRowManager);
}

/**
 * @description Stops guarding chat rows.
 */
export function stop() {
	stopWaiting?.();
	stopWaiting = undefined;
	Patcher.unpatchAll();
}

export default { start, stop };
