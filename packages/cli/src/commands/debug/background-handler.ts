import type { BackgroundRun, BackgroundStatus } from '@unbound-app/types/background';

import { evaluateOnDevice, notConnected, toDeviceCode } from '~/lib/device';
import { formatBackground } from '~/lib/background-format';
import { evalFailure, failure } from '~/lib/command-error';
import type { DevicePrelude } from '~/lib/device-prelude';
import type { CommandHandler } from '~/lib/lazy-handler';
import { parse, Type } from '~/lib/schema';

import type backgroundCommand from './background';

const RUN_TIMEOUT_MS = 90_000;

const jobSchema = Type.Object({ name: Type.String(), owner: Type.String() });

const resultSchema = Type.Union([
	Type.Object({
		name: Type.String(),
		owner: Type.String(),
		durationMs: Type.Number(),
		ok: Type.Literal(true),
		skipped: Type.Optional(Type.String()),
	}),
	Type.Object({
		name: Type.String(),
		owner: Type.String(),
		durationMs: Type.Number(),
		ok: Type.Literal(false),
		error: Type.String(),
	}),
]);

const statusSchema = Type.Object({
	jobs: Type.Array(jobSchema),
	lastRun: Type.Optional(
		Type.Object({
			trigger: Type.Union([Type.Literal('loader'), Type.Literal('manual')]),
			startedAt: Type.Number(),
			durationMs: Type.Number(),
			jobs: Type.Array(resultSchema),
		}),
	),
	gate: Type.Optional(
		Type.Object({
			sinceLastMs: Type.Number(),
			intervalMs: Type.Number(),
			dueInMs: Type.Number(),
			runs: Type.Number(),
			running: Type.Boolean(),
			scheduled: Type.Optional(Type.String()),
		}),
	),
});

const responseSchema = Type.Union([
	Type.Object({ missing: Type.Literal(true) }),
	Type.Object({ status: statusSchema, now: Type.Number() }),
]);

async function readBackground({ unbound }: DevicePrelude, run: boolean): Promise<string> {
	const background = Reflect.get(unbound, 'background') as
		| { run: () => Promise<BackgroundRun>; status: () => BackgroundStatus }
		| undefined;

	if (!background) {
		return JSON.stringify({ missing: true });
	}

	if (run) {
		await background.run();
	}

	return JSON.stringify({ status: background.status(), now: Date.now() });
}

const handler: CommandHandler<typeof backgroundCommand.schema> = async (
	{ run = false },
	{ client },
) => {
	const result = await evaluateOnDevice(
		client,
		toDeviceCode(readBackground, run),
		RUN_TIMEOUT_MS,
	);

	if (!result) {
		return notConnected(client);
	}

	if (!result.ok) {
		return evalFailure(result);
	}

	const parsed = parse(responseSchema, JSON.parse(result.value));

	if ('missing' in parsed) {
		return failure(
			'unsupported',
			'This client has no background jobs; update the Unbound bundle.',
		);
	}

	return { ok: true, text: formatBackground(parsed.status, parsed.now), data: parsed.status };
};

export default handler;
