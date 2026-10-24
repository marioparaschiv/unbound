import { appendSavedCommands } from '~/commands';
import { getTags } from '~/saved-commands';
import { Commands, Patcher } from '~/modules';
import { sendTag } from '~/send';

/**
 * @description Lists the saved commands among Discord's built-in slash commands.
 * @returns A function that removes the patch.
 */
export function patchCommands(): () => void {
	return Patcher.after(Commands, 'getBuiltInCommands', ({ args: [types], result }) => {
		if (!Array.isArray(types) || !Array.isArray(result)) return;

		appendSavedCommands(types, result, getTags(), sendTag);
	});
}

export default patchCommands;
