import type { MeasuredCheck } from './compare-device-matrix';
import type { Device } from './device';
import { isDisconnect } from './device-bridge';
import { dropBaseline, dropReason, relaunchCommands, type DropBaseline } from './device-drops';
import { developerModeScript, pluginsSettledScript } from './device-scripts';
import { fixtureScript } from './fixture-scripts';
import { waitFor } from './wait-for';

export type FixtureChannel = { guild: string; channel: string };

/** What every phase of one device's run shares: the device, where its report goes, and its drops. */
export type MatrixSession = {
	device: Device;
	out: string;
	fixtures: FixtureChannel | undefined;
	/** The last run's checks, when this run may keep what did not change. */
	previousRun: MeasuredCheck[] | undefined;
	/** Screens that look different from the last good run. */
	screenChanges: string[];
	/** Each drop as `<what was running>: <reason>`. */
	drops: string[];
	dropsBefore: DropBaseline;
	relaunched: boolean;
	log(line: string): void;
};

const RELAUNCH_TIMEOUT_MS = 120_000;
const PLUGINS_SETTLE_TIMEOUT_MS = 30_000;
const SETTLE_POLL_MS = 500;

/**
 * @description Waits for Discord to answer again after a relaunch: its debugger reconnects, then every enabled plugin has started or failed.
 */
export async function waitUntilBack(device: Device): Promise<void> {
	if (!(await device.waitForDevice(RELAUNCH_TIMEOUT_MS))) {
		throw new Error('Discord did not come back after a relaunch.');
	}

	await waitFor(async () => (await device.evaluate(pluginsSettledScript())) === 'settled', {
		timeoutMs: PLUGINS_SETTLE_TIMEOUT_MS,
		intervalMs: SETTLE_POLL_MS,
		sleep: device.sleep,
	});
}

/**
 * @description Records why the device dropped, relaunches Discord and restores what the run set up.
 * @param session The run.
 * @param label What was running when it dropped, such as a plugin id.
 * @returns The reason it dropped.
 */
export async function recover(session: MatrixSession, label: string): Promise<string> {
	const { device, fixtures } = session;
	const reason =
		(await dropReason(device.target, session.dropsBefore, device.run)) ??
		'Discord stopped answering, and no crash or memory report explains it';

	session.log(`dropped: ${label}: ${reason}`);
	session.drops.push(`${label}: ${reason}`);
	session.relaunched = true;

	for (const command of relaunchCommands(device.target)) await device.run(command);

	await waitUntilBack(device);

	if (fixtures) await device.evaluate(fixtureScript(fixtures.guild, fixtures.channel));

	await device.evaluate(developerModeScript(true));
	session.dropsBefore = await dropBaseline(device.target, device.run);

	return reason;
}

/**
 * @description Runs a step, and once more after relaunching Discord if the device dropped during it.
 * @template T The step's result.
 * @param session The run.
 * @param label What the step is, for the drop's record.
 * @param step The step.
 * @returns What the step returned.
 */
export async function afterRecovery<T>(
	session: MatrixSession,
	label: string,
	step: () => Promise<T>,
): Promise<T> {
	try {
		return await step();
	} catch (error) {
		if (!isDisconnect(error)) throw error;

		await recover(session, label);

		return step();
	}
}

export default { waitUntilBack, recover, afterRecovery };
