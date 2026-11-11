import { metro, patcher } from '@unbound-app/api';

import { appendSavedCommands } from '~/lib/commands';
import { getTags } from '~/lib/saved-commands';
import { Messages } from '~/lib/modules';
import { sendTag } from '~/lib/send';

/**
 * @description Lists the saved commands among Discord's built-in slash commands, and sends their responses when they run.
 * Patches `getBuiltInCommands` on Discord's slash command module, sends through the message actions module (`sendMessage`, `_sendMessage`), uploads through the cloud uploader module (`CloudUpload`), and opens the photo library through the image picker module.
 * Reads the PendingReply store.
 */
export function patchCommands(): void {
	const Commands = metro.findByProps('getBuiltInCommands');

	if (!Commands || !Messages) {
		logger.warn('Saved commands skipped: Discord moved Commands or Messages.');

		return;
	}

	patcher.after(Commands, 'getBuiltInCommands', ({ args: [types], result }) => {
		if (!Array.isArray(types) || !Array.isArray(result)) return;

		appendSavedCommands(types, result, getTags(), sendTag);
	});
}
