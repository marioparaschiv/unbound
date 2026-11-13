import type { CommandOutput } from '@unbound-app/debugger-protocol/registry';

import {
	evaluateOnDevice,
	NOT_CONNECTED,
	RECORDING_GRACE_MS,
	toDeviceCode,
	type DeviceClient,
} from '~/lib/device';
import { chromeTraceSchema, formatProfile, summarizeProfile } from '~/lib/profile-summary';
import { evalFailure, failure } from '~/lib/command-error';
import type { DevicePrelude } from '~/lib/device-prelude';
import type { CommandHandler } from '~/lib/lazy-handler';
import type { StaticDecode } from '~/lib/schema';
import { parseJson } from '~/lib/parse-json';

import type profileCommand from './profile';

type ProfilerGlobal = {
	NativePlatform?: { profiler?: { start(): boolean; stop(): string | undefined } };
};

async function recordProfile(_device: DevicePrelude, duration: number): Promise<string> {
	const profiler = (globalThis as ProfilerGlobal).NativePlatform?.profiler;

	if (!profiler?.start()) {
		throw new Error(
			"Hermes' sampling profiler is missing from this loader, or a freeze report is using it.",
		);
	}

	await new Promise((resolve) => setTimeout(resolve, duration));

	return profiler.stop() ?? '';
}

const handler: CommandHandler<typeof profileCommand.schema> = async (input, { client }) =>
	runProfile(client, input);

/**
 * @description Records a sampled profile on the device and summarises it.
 * @param client The bridge controller.
 * @param input The parsed command input.
 * @returns The ranked report, or why it failed.
 */
export async function runProfile(
	client: DeviceClient,
	input: StaticDecode<typeof profileCommand.schema>,
): Promise<CommandOutput> {
	const result = await evaluateOnDevice(
		client,
		toDeviceCode(recordProfile, input.duration),
		input.duration + RECORDING_GRACE_MS,
	);

	if (!result) {
		return NOT_CONNECTED;
	}

	if (!result.ok) {
		return evalFailure(result, result.error, result);
	}

	if (!result.value) {
		return failure('device-error', 'The profiler stopped without a trace.');
	}

	const trace = parseJson(result.value, chromeTraceSchema, 'The device');

	if (!trace.ok) {
		return failure('device-error', trace.error);
	}

	if (input.out) {
		await Bun.write(input.out, result.value);
	}

	const summary = summarizeProfile(trace.value, input.top);
	const saved = input.out ? `\n\nSaved the trace to ${input.out}.` : '';

	return { ok: true, text: formatProfile(summary) + saved, data: summary };
}

export default handler;
