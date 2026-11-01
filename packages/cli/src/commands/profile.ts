import type { CommandDefinition, CommandOutput } from '@unbound-app/debugger-protocol/registry';
import type { UnboundGlobal } from '@unbound-app/api/global';
import { z } from 'zod';

import { evaluateOnDevice, NOT_CONNECTED, toDeviceCode, type DeviceClient } from '~/lib/device';
import { chromeTraceSchema, formatProfile, summarizeProfile } from '~/lib/profile-summary';
import { bridgePortField } from '~/lib/context';
import { parseJson } from '~/lib/parse-json';

const RESULT_GRACE_MS = 10_000;

const schema = z.object({
	duration: z
		.number()
		.int()
		.positive()
		.max(60_000)
		.default(5000)
		.describe('How long to sample the JavaScript thread, in milliseconds.'),
	top: z
		.number()
		.int()
		.positive()
		.default(20)
		.describe('How many functions and sources to list.'),
	out: z
		.string()
		.default('')
		.describe('Also save the raw Chrome trace here, to open in Perfetto or chrome://tracing.'),
	port: bridgePortField,
});

type ProfilerGlobal = {
	NativePlatform?: { profiler?: { start(): boolean; stop(): string | undefined } };
};

async function recordProfile(_unbound: UnboundGlobal, duration: number): Promise<string> {
	const profiler = (globalThis as ProfilerGlobal).NativePlatform?.profiler;

	if (!profiler?.start()) {
		throw new Error(
			"Hermes' sampling profiler is missing from this loader, or a freeze report is using it.",
		);
	}

	await new Promise((resolve) => setTimeout(resolve, duration));

	return profiler.stop() ?? '';
}

const profileCommand: CommandDefinition<typeof schema> = {
	name: 'profile',
	description:
		"Sample the connected device's JavaScript thread with Hermes' sampling profiler for a while, " +
		'then rank the functions and sources it spent the time in. Scroll or open the screen to measure ' +
		'while it records. `--out` also saves the raw trace.',
	surfaces: { cli: 'root', mcp: true },
	schema,
	handler(input, { client }) {
		return runProfile(client, input);
	},
};

/**
 * @description Records a sampled profile on the device and summarises it.
 * @param client The bridge controller.
 * @param input The parsed command input.
 * @returns The ranked report, or why it failed.
 */
export async function runProfile(
	client: DeviceClient,
	input: z.infer<typeof schema>,
): Promise<CommandOutput> {
	const result = await evaluateOnDevice(
		client,
		toDeviceCode(recordProfile, input.duration),
		input.duration + RESULT_GRACE_MS,
	);

	if (!result) {
		return NOT_CONNECTED;
	}

	if (!result.ok) {
		return { ok: false, text: result.error, data: result };
	}

	if (!result.value) {
		return { ok: false, text: 'The profiler stopped without a trace.' };
	}

	const trace = parseJson(result.value, chromeTraceSchema, 'The device');

	if (!trace.ok) {
		return { ok: false, text: trace.error };
	}

	if (input.out) {
		await Bun.write(input.out, result.value);
	}

	const summary = summarizeProfile(trace.value, input.top);
	const saved = input.out ? `\n\nSaved the trace to ${input.out}.` : '';

	return { ok: true, text: formatProfile(summary) + saved, data: summary };
}

export default profileCommand;
