import { patcher } from '@unbound-app/api';

import { appendSavedCommands } from '~/commands';
import { getTags } from '~/saved-commands';
import { Commands } from '~/modules';
import { sendTag } from '~/send';

/**
 * @description Lists the saved commands among Discord's built-in slash commands.
 */
export function patchCommands(): void {
	patcher.after(Commands, 'getBuiltInCommands', ({ args: [types], result }) => {
		if (!Array.isArray(types) || !Array.isArray(result)) return;

		appendSavedCommands(types, result, getTags(), sendTag);
	});
}

export default patchCommands;
