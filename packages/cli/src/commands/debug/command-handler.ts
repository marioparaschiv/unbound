import { runOnDevice, toDeviceCode } from '~/lib/device';
import type { CommandHandler } from '~/lib/lazy-handler';
import { runSlashCommand } from '~/lib/slash-commands';
import { failure } from '~/lib/command-error';

import type commandCommand from './command';

function parseOptions(pairs: string[]): Record<string, string> | string {
	const options: Record<string, string> = {};

	for (const pair of pairs) {
		const split = pair.indexOf('=');

		if (split <= 0) {
			return pair;
		}

		options[pair.slice(0, split)] = pair.slice(split + 1);
	}

	return options;
}

const handler: CommandHandler<typeof commandCommand.schema> = async (
	{ name, options, channel },
	{ client },
) => {
	const parsed = parseOptions(options);

	if (typeof parsed === 'string') {
		return failure('invalid-input', `Options are name=value pairs; got ${parsed}.`, {
			field: 'options',
		});
	}

	return runOnDevice(client, toDeviceCode(runSlashCommand, name, parsed, channel ?? null));
};

export default handler;
