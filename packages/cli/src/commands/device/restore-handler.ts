import type { CommandHandler } from '~/lib/lazy-handler';
import { openDeviceTarget } from '~/lib/device-target';
import { restoreSnapshot } from '~/lib/device-state';
import { failure } from '~/lib/command-error';

import type restoreCommand from './restore';

const handler: CommandHandler<typeof restoreCommand.schema> = async ({
	name,
	serial,
	ios,
	udid,
	restart,
}) => {
	const target = await openDeviceTarget({ serial, ios, udid });

	if ('error' in target) {
		return failure(target.code, target.error);
	}

	return restoreSnapshot(name, target, { restart });
};

export default handler;
