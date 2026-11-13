import type { CommandHandler } from '~/lib/lazy-handler';
import { openDeviceTarget } from '~/lib/device-target';
import { saveSnapshot } from '~/lib/device-state';
import { failure } from '~/lib/command-error';

import type saveCommand from './save';

const handler: CommandHandler<typeof saveCommand.schema> = async ({ name, serial, ios, udid }) => {
	const target = await openDeviceTarget({ serial, ios, udid });

	if ('error' in target) {
		return failure(target.code, target.error);
	}

	return saveSnapshot(name, target);
};

export default handler;
