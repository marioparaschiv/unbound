import type { CommandHandler } from '~/lib/lazy-handler';
import { openDeviceTarget } from '~/lib/device-target';
import { pushToDiscord } from '~/lib/device-files';
import { failure } from '~/lib/command-error';

import type pushCommand from './push';

const handler: CommandHandler<typeof pushCommand.schema> = async ({
	local,
	path,
	serial,
	ios,
	udid,
	restart,
}) => {
	const target = await openDeviceTarget({ serial, ios, udid });

	if ('error' in target) {
		return failure(target.code, target.error);
	}

	return pushToDiscord(target, local, path, { restart });
};

export default handler;
