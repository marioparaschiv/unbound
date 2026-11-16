import type { CommandHandler } from '~/lib/lazy-handler';
import { openDeviceTarget } from '~/lib/device-target';
import { pullFromDiscord } from '~/lib/device-files';
import { failure } from '~/lib/command-error';

import type pullCommand from './pull';

const handler: CommandHandler<typeof pullCommand.schema> = async ({
	path,
	local,
	serial,
	ios,
	udid,
}) => {
	const target = await openDeviceTarget({ serial, ios, udid });

	if ('error' in target) {
		return failure(target.code, target.error);
	}

	return pullFromDiscord(target, path, local);
};

export default handler;
