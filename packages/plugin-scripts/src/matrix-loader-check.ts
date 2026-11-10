import { evaluateJson } from './device';
import { isDisconnect } from './device-bridge';
import { screenSize, swipeAll, swipeCommands } from './device-io';
import { logLinesSchema, pluginLogScript } from './device-scripts';
import {
	judgeSelfTest,
	SELF_TEST_MARKER,
	selfTestCancellationScript,
	selfTestCountsSchema,
	selfTestFiredScript,
	selfTestFinishScript,
	selfTestStartScript,
	type SelfTestResult,
} from './loader-self-test';
import { parsePluginErrors } from './log-parsers';
import { recover, type MatrixSession } from './matrix-session';
import { waitFor } from './wait-for';

const SELF_TEST_SWIPES = 4;
const FIRE_TIMEOUT_MS = 5_000;
const LOG_TIMEOUT_MS = 5_000;
const POLL_MS = 250;

async function selfTest({ device }: MatrixSession): Promise<SelfTestResult> {
	const started = new Date(Date.now() - 1_000).toISOString();
	const host = await device.evaluate(selfTestStartScript());

	if (host.startsWith('error: ')) return { ok: false, detail: host.slice('error: '.length) };

	const poll = { intervalMs: POLL_MS, sleep: device.sleep };

	await swipeAll(
		device.run,
		swipeCommands(device.target, await screenSize(device.target, device.run), SELF_TEST_SWIPES),
	);
	await waitFor(async () => (await device.evaluate(selfTestFiredScript())) === 'fired', {
		...poll,
		timeoutMs: FIRE_TIMEOUT_MS,
	});

	const counts = await evaluateJson(device, selfTestFinishScript(), selfTestCountsSchema);
	const ended = await evaluateJson(device, selfTestCancellationScript(), selfTestCountsSchema);

	if (ended.error) return { ok: false, detail: ended.error };

	if (ended.host === counts.host) counts.cancellations = ended.cancellations;

	let errors = new Map<string, string[]>();

	// The loader writes the thrown hook error to its log on its own thread; wait until it is there.
	await waitFor(
		async () => {
			const lines = await evaluateJson(device, pluginLogScript(), logLinesSchema);

			errors = parsePluginErrors(lines, started);

			return (errors.get(counts.host ?? '') ?? []).some((error) =>
				error.includes(SELF_TEST_MARKER),
			);
		},
		{ ...poll, timeoutMs: LOG_TIMEOUT_MS },
	);

	return judgeSelfTest(counts, errors);
}

/**
 * @description Self-tests the loader's hooks and native cancellations, relaunching Discord when it drops meanwhile.
 * @param session The run.
 * @returns Whether the loader passed, with the reason.
 */
export async function runLoaderCheck(session: MatrixSession): Promise<SelfTestResult> {
	try {
		return await selfTest(session);
	} catch (error) {
		if (!isDisconnect(error)) throw error;

		return {
			ok: false,
			detail: `Discord stopped answering during the self-test: ${await recover(session, 'the loader self-test')}`,
		};
	}
}

export default { runLoaderCheck };
