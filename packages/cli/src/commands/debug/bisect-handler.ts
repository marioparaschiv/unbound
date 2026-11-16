import type { DevicePrelude } from '~/lib/device-prelude';
import { runOnDevice, toDeviceCode } from '~/lib/device';
import type { CommandHandler } from '~/lib/lazy-handler';

import type bisectCommand from './bisect';

type BisectStep = 'start' | 'yes' | 'no' | 'stop' | 'status';

/**
 * @description Runs one bisect step on the device and describes where it stands.
 * @param device The device prelude.
 * @param step The step to take.
 * @returns What happened, and which plugins are on, as a line of text.
 */
export function bisectOnDevice({ unbound }: DevicePrelude, step: BisectStep): string {
	const { plugins } = unbound;
	const name = (id: string) => plugins.get(id)?.manifest.name ?? id;
	const describe = (status: ReturnType<typeof plugins.bisectStatus>) =>
		status
			? `Round ${status.round}, about ${status.roundsLeft} left. On: ${status.tested.map(name).join(', ') || 'no plugins'}. Reproduce the problem, then answer yes or no.`
			: 'No bisect is running.';

	if (step === 'start') {
		const first = plugins.startBisect();

		return first ? describe(first) : 'No plugins are on to test.';
	}

	if (step === 'stop') {
		plugins.stopBisect();

		return 'Stopped; the plugins that were on are back on.';
	}

	if (step === 'status') {
		return describe(plugins.bisectStatus());
	}

	const next = plugins.answerBisect(step === 'yes');

	if (next && 'culprit' in next) {
		return next.culprit
			? `Found it: ${name(next.culprit)} (${next.culprit}) causes the problem. It stays off; the other plugins are back on.`
			: 'The problem happens with every plugin off, so no plugin causes it. The plugins are back on.';
	}

	return describe(next);
}

const handler: CommandHandler<typeof bisectCommand.schema> = async ({ step }, { client }) =>
	runOnDevice(client, toDeviceCode(bisectOnDevice, step));

export default handler;
