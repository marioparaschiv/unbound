import type { SettingCommon } from '@unbound-app/types/settings';

import { evaluateCondition, type SettingPredicates } from '~/ui/settings-kit/conditions';
import type { DefinedSettings } from '~/storage/define';

/** Whether a row shows, and whether it is disabled. */
export type RowState = { visible: boolean; disabled: boolean };

/**
 * @description Reads whether a row shows and is enabled from its `visibleWhen` and `disabledWhen`, re-rendering on any settings change while it has either.
 * @param settings The plugin's settings.
 * @param path The row's dot-separated key.
 * @param labels The row's options.
 * @param predicates The lifted predicates.
 * @returns Whether the row shows, and whether it is disabled.
 */
function useConditions(
	settings: DefinedSettings,
	path: string,
	{ visibleWhen, disabledWhen }: SettingCommon,
	predicates: SettingPredicates,
): RowState {
	settings.useVersion(visibleWhen !== undefined || disabledWhen !== undefined);

	return {
		visible: evaluateCondition(settings, path, 'visibleWhen', visibleWhen, predicates) ?? true,
		disabled:
			evaluateCondition(settings, path, 'disabledWhen', disabledWhen, predicates) ?? false,
	};
}

export default useConditions;
