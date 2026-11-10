import { join } from 'node:path';

import type { MeasuredCheck } from './compare-device-matrix';
import { evaluateJson } from './device';
import { isDisconnect } from './device-bridge';
import type { CatalogPlugin } from './device-matrix';
import { discordMemory } from './device-memory';
import { cycleResultSchema, cycleScript, restoreScript } from './device-scripts';
import { fixtureScript, fixturesPresentScript } from './fixture-scripts';
import { growthPerCycle, leakNote, liveHeapScript } from './leak-check';
import { checkFromCycle } from './matrix-policy';
import { recover, type MatrixSession } from './matrix-session';
import { reusableLeak, reusableSettings } from './run-reuse';
import {
	describeScreenChange,
	referenceFor,
	saveFullResolutionBands,
	screenDifference,
} from './screen-diff';
import { withSettings } from './settings-check';
import {
	closeScreenScript,
	settingsClosedScript,
	settingsProbeSchema,
	settingsProbeScript,
	settingsScreenScript,
	type SettingsProbe,
} from './settings-scripts';
import { waitFor } from './wait-for';

export const SETTINGS_SCREEN_SUFFIX = '.settings.png';
export const COLLECT_GARBAGE_SCRIPT =
	"typeof gc === 'function' ? (gc(), 'collected') : 'unavailable'";

const SCREEN_TIMEOUT_MS = 5_000;
const SCREEN_POLL_MS = 200;
// The navigator's push and pop animations report no end the device scripts can read, so the
// screenshot waits them out once the probe saw the panel mount or unmount.
const SCREEN_TRANSITION_MS = 500;

async function captureSettings(
	{ device, out, screenChanges }: MatrixSession,
	id: string,
): Promise<{ file: string | undefined; probe: SettingsProbe } | undefined> {
	if ((await device.evaluate(settingsScreenScript(id))) !== 'opened') return;

	const poll = { timeoutMs: SCREEN_TIMEOUT_MS, intervalMs: SCREEN_POLL_MS, sleep: device.sleep };

	await waitFor(async () => {
		const probe = await evaluateJson(device, settingsProbeScript(), settingsProbeSchema);

		return probe.rendered || Boolean(probe.error);
	}, poll);
	await device.sleep(SCREEN_TRANSITION_MS);

	const file = `${id}${SETTINGS_SCREEN_SUFFIX}`;
	const previous = referenceFor(join(out, file));
	const captured = await device.screenshot(join(out, file));

	if (captured && previous) {
		const change = describeScreenChange(
			`${id} settings`,
			await screenDifference(previous, join(out, file)),
		);

		if (change) screenChanges.push(change);
	}

	const probe = await evaluateJson(device, settingsProbeScript(), settingsProbeSchema);

	await device.evaluate(closeScreenScript());
	await waitFor(async () => (await device.evaluate(settingsClosedScript())) === 'closed', poll);
	await device.sleep(SCREEN_TRANSITION_MS);

	return { file: captured ? file : undefined, probe };
}

async function measure(session: MatrixSession, plugin: CatalogPlugin): Promise<MeasuredCheck> {
	const { device, out, fixtures, previousRun } = session;

	if (
		fixtures &&
		(await device.evaluate(fixturesPresentScript(fixtures.channel))) !== 'present'
	) {
		session.log(`fixtures were gone before ${plugin.id}; staging them again`);
		await device.evaluate(fixtureScript(fixtures.guild, fixtures.channel));
	}

	const result = await evaluateJson(device, cycleScript(plugin.id), cycleResultSchema);
	const file = join(out, `${plugin.id}.png`);
	const captured = result.installed && (await device.screenshot(file));

	if (captured) await saveFullResolutionBands(file, join(out, 'crops'), plugin.id);

	const keptSettings = reusableSettings(plugin.id, result.bundleHash, previousRun);
	const settings =
		result.installed && !keptSettings ? await captureSettings(session, plugin.id) : undefined;

	if (result.installed && !result.wasStarted) await device.evaluate(restoreScript(plugin.id));

	const check = checkFromCycle(result, captured ? `${plugin.id}.png` : undefined);

	if (keptSettings) {
		check.evidence.push(`${keptSettings} (kept from the last run, the plugin is unchanged)`);
	}

	return settings ? withSettings(check, settings.file, settings.probe) : check;
}

/**
 * @description Cycles each plugin through stop, start and reload, with its screenshot, settings screen and memory swing; a plugin the device drops twice during fails.
 * @param session The run.
 * @param catalog The plugins to cycle.
 * @param checks Receives each plugin's check as it is measured, so a run that fails later keeps them.
 */
export async function cyclePlugins(
	session: MatrixSession,
	catalog: CatalogPlugin[],
	checks: MeasuredCheck[],
): Promise<void> {
	const { device } = session;

	for (const plugin of catalog) {
		let check: MeasuredCheck | undefined;

		for (let attempt = 0; !check; attempt++) {
			try {
				const before = await discordMemory(device.target, device.run);

				check = await measure(session, plugin);

				await device.evaluate(COLLECT_GARBAGE_SCRIPT);

				const after = await discordMemory(device.target, device.run);

				if (before !== undefined && after !== undefined) {
					check.memoryDeltaMB = Math.round(after - before);
				}
			} catch (error) {
				if (!isDisconnect(error)) throw error;

				const reason = await recover(session, plugin.id);

				if (attempt >= 1) {
					check = {
						id: plugin.id,
						behavior: 'fail',
						lifecycle: 'fail',
						evidence: [],
						note: `the device dropped twice: ${reason}`,
					};
				}
			}
		}

		checks.push(check);
		session.log(
			`${check.lifecycle === 'pass' && check.behavior === 'pass' ? 'pass' : 'FAIL'} ${plugin.id}`,
		);
	}
}

async function cycleQuietly({ device }: MatrixSession, id: string): Promise<void> {
	const result = await evaluateJson(device, cycleScript(id), cycleResultSchema);

	if (result.installed && !result.wasStarted) await device.evaluate(restoreScript(id));
}

function recordLeak(check: MeasuredCheck, perCycle: number, cycles: number) {
	check.leakPerCycleMB = perCycle;

	const note = leakNote(perCycle, cycles);

	if (note) {
		check.behavior = 'fail';
		check.note = [check.note, note].filter(Boolean).join('; ');
	}
}

async function leakCheck(session: MatrixSession, check: MeasuredCheck, cycles: number) {
	const { device } = session;
	const reused = reusableLeak(check, session.previousRun);

	if (reused !== undefined) {
		recordLeak(check, reused, cycles);
		check.evidence.push('leak check: kept from the last run, the bundle is unchanged');
		session.log(`leak check ${check.id}: ${reused} MB per cycle, kept from the last run`);

		return;
	}

	await cycleQuietly(session, check.id);

	const before = Number(await device.evaluate(liveHeapScript()));

	for (let cycle = 0; cycle < cycles; cycle++) await cycleQuietly(session, check.id);

	const perCycle = growthPerCycle(
		before,
		Number(await device.evaluate(liveHeapScript())),
		cycles,
	);

	if (perCycle === undefined) return;

	recordLeak(check, perCycle, cycles);
	session.log(`leak check ${check.id}: ${perCycle} MB per cycle`);
}

/**
 * @description Cycles each measured plugin `cycles` more times and fails those whose live heap grows by too much per cycle.
 * @param session The run.
 * @param checks The checks to add the leak to.
 * @param cycles How many cycles to measure over.
 */
export async function checkLeaks(
	session: MatrixSession,
	checks: MeasuredCheck[],
	cycles: number,
): Promise<void> {
	for (const check of checks) {
		try {
			await leakCheck(session, check, cycles);
		} catch (error) {
			if (!isDisconnect(error)) throw error;

			await recover(session, `the leak check of ${check.id}`);
		}
	}
}

export default { cyclePlugins, checkLeaks, SETTINGS_SCREEN_SUFFIX, COLLECT_GARBAGE_SCRIPT };
