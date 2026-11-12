import type { CommandHandler } from '~/lib/lazy-handler';
import { openDeviceTarget } from '~/lib/device-target';
import { resetDevice } from '~/lib/device-state';
import { failure } from '~/lib/command-error';

import type resetCommand from './reset';

const handler: CommandHandler<typeof resetCommand.schema> = async ({
	serial,
	ios,
	udid,
	restart,
}) => {
	const target = await openDeviceTarget({ serial, ios, udid });

	if ('error' in target) {
		return failure(target.code, target.error);
	}

	return resetDevice(target, { restart });
};

export default handler;
