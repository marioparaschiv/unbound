import { createLogger } from '@unbound-app/logger';
import toError from '@unbound-app/utils/to-error';

import { format } from '~/i18n/api';
import { show } from '~/toasts/api';

/** The functions a plugin's `src/actions.ts` exports, which its `setting.button` rows run, by name. */
export type SettingActions = Record<string, SettingAction | undefined>;

/** One export of `src/actions.ts`: it takes nothing, and may be async. */
export type SettingAction = () => void | Promise<void>;

const logger = createLogger('UI', 'SchemaPanel');

/**
 * @description Runs one export of a plugin's `src/actions.ts`. One that throws or rejects is logged and shown as a toast.
 * @param actions The exports of `src/actions.ts`.
 * @param name The export to run.
 * @param pluginId The plugin's id, for the log.
 * @returns A promise that settles once the action has.
 */
export async function runSettingsAction(
	actions: SettingActions,
	name: string,
	pluginId: string,
): Promise<void> {
	try {
		const action = actions[name];

		if (typeof action !== 'function') {
			throw new TypeError(`${name} is not a function src/actions.ts exports.`);
		}

		await action();
	} catch (error) {
		logger.error(`Failed to run settings action ${name} for ${pluginId}:`, error);
		show({
			title: format('UNBOUND_SETTING_ACTION_FAILED', { name }),
			content: toError(error).message,
		});
	}
}
