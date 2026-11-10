import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { patcher } from '@unbound-app/api';

import { appendSavedCommands } from '~/commands/commands';
import { Commands, Messages } from '~/commands/modules';
import { getTags } from '~/commands/saved-commands';
import { sendTag } from '~/commands/send';

/**
 * @description Lists the saved commands among Discord's built-in slash commands, and sends their responses when they run.
 * Patches `getBuiltInCommands` on `metro.common.Commands`, sends through the message actions module (`sendMessage`, `_sendMessage`), uploads through the cloud uploader module (`CloudUpload`), and opens the photo library through the image picker module.
 * Reads the PendingReply store. The Addon scope removes the patch when the plugin stops.
 */
export function startCommands(): void {
	if (!ensureModules({ Commands, Messages })) return;

	patcher.after(Commands, 'getBuiltInCommands', ({ args: [types], result }) => {
		if (!Array.isArray(types) || !Array.isArray(result)) return;

		appendSavedCommands(types, result, getTags(), sendTag);
	});
}
