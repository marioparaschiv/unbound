import { addLocalMessage, removeLocalMessages } from '~/lib/local-messages';
import { runOnDevice, toDeviceCode } from '~/lib/device';
import type { CommandHandler } from '~/lib/lazy-handler';

import type messageCommand from './message';

const handler: CommandHandler<typeof messageCommand.schema> = (
	{ action, content, channel, author, attachment, state, ids },
	{ client },
) => {
	const channelId = channel ?? null;
	const code =
		action === 'add'
			? toDeviceCode(addLocalMessage, {
					channelId,
					author,
					content,
					attachment: attachment ?? null,
					state,
				})
			: toDeviceCode(removeLocalMessages, channelId, ids);

	return runOnDevice(client, code);
};

export default handler;
