import toError from '@unbound-app/utils/to-error';

import { openScreen, type ScreenParams } from '~/lib/navigation';
import { runOnDevice, toDeviceCode } from '~/lib/device';
import type { CommandHandler } from '~/lib/lazy-handler';
import { failure } from '~/lib/command-error';
import { parse, Type } from '~/lib/schema';

import type openCommand from './open';

const paramsSchema = Type.Record(
	Type.String(),
	Type.Union([Type.String(), Type.Number(), Type.Boolean(), Type.Null()]),
);

const handler: CommandHandler<typeof openCommand.schema> = async (
	{ screen, params },
	{ client },
) => {
	let parsed: ScreenParams;

	try {
		parsed = parse(paramsSchema, JSON.parse(params));
	} catch (error) {
		return failure(
			'invalid-input',
			`params must be a JSON object of plain values: ${toError(error).message}`,
			{ field: 'params' },
		);
	}

	return runOnDevice(client, toDeviceCode(openScreen, screen, parsed));
};

export default handler;
