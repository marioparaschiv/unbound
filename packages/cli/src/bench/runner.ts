import { setTimeout as sleep } from 'node:timers/promises';
import { join } from 'node:path';

import {
	benchSettings,
	installScript,
	publishBuild,
	readSettings,
	restoreScript,
	snapshotScript,
	writeSettings,
} from '~/bench/device';
import { runLaunch, type LaunchContext, type LaunchSpec } from '~/bench/launch';
import { schedule, type LaunchKind, type Plan } from '~/bench/plan';
import type { RunIdentity, RunRecord } from '~/bench/record';
import { formatValue, METRICS } from '~/bench/metrics';
import type { VariantBuild } from '~/bench/build';
import { evaluateOnDevice } from '~/lib/device';

/** A switch discards warm launches until one ran the variant's bundle; past this many the loader is stuck. */
const MAX_WARMUPS = 3;
const RESTORE_WAIT_MS = 90_000;
const PROGRESS_METRICS = [
	'bundle_executed_ms',
	'initialized_ms',
	'discord_fcp_ms',
	'heap_idle_mb',
	'live_idle_mb',
	'footprint_idle_mb',
	'modules_idle',
];

/**
 * @description Puts the device into its bench state: restores a snapshot an interrupted run left, takes a fresh
 * snapshot, then points the loader at the bench server and sets up the addon mode's settings.
 * @param context The device, bench server and addon mode.
 * @param builds The variants' builds.
 * @param print Prints progress.
 */
export async function prepareDevice(
	context: LaunchContext,
	builds: VariantBuild[],
	print: (line: string) => void,
): Promise<void> {
	const { vphone, server, paths } = context;

	await vphone.stopDiscord();

	if ((await vphone.shell(restoreScript())).includes('restored')) {
		print('Restored the device from the snapshot an interrupted run left behind.');
	}

	await vphone.shell(snapshotScript(paths));
	const pluginIds = [...new Set(builds.flatMap((build) => build.pluginIds))];

	await writeSettings(
		vphone,
		server,
		paths,
		benchSettings(
			await readSettings(vphone, paths),
			`${server.origin}/unbound.bundle`,
			context.addons,
			pluginIds,
		),
	);
	print(
		`Snapshot taken; the loader now fetches from ${server.origin}, addons ${context.addons}.`,
	);
}

/**
 * @description Puts back everything the snapshot holds, relaunches Discord and waits for Unbound on the bridge.
 * Safe to run after a crash at any point: with no snapshot it only clears leftovers.
 * @param context The device and bridge.
 * @param print Prints progress.
 * @returns Whether Unbound answered on the bridge after the relaunch.
 */
export async function restoreDevice(
	context: Pick<LaunchContext, 'vphone' | 'client'>,
	print: (line: string) => void,
): Promise<boolean> {
	const { vphone, client } = context;

	await vphone.stopDiscord();
	const restored = (await vphone.shell(restoreScript())).includes('restored');

	print(
		restored
			? 'Restored the device snapshot (Unbound folder, loader, resources).'
			: 'No snapshot to restore.',
	);
	await vphone.launchDiscord();
	const deadline = Date.now() + RESTORE_WAIT_MS;

	while (Date.now() < deadline) {
		const result = await evaluateOnDevice(client, 'typeof unbound', 5_000);

		if (result?.ok && result.value === 'object') {
			await vphone.dismissAlert();

			return true;
		}

		await sleep(2_000);
	}

	return false;
}

/**
 * @description Whether a launch is a warm-up that ran a bundle other than its variant's. Such a launch may fail
 * without stopping the run: a loader that runs Unbound before Discord's bundle cannot start an older cached bundle.
 * @param identity The launch's identity.
 * @param bundleSha256 The variant's bundle hash.
 * @returns Whether the launch ran a stale bundle during warm-up.
 */
export function ranStaleBundle(
	identity: Pick<RunIdentity, 'discarded' | 'ranBundleSha256'>,
	bundleSha256: string,
): boolean {
	return identity.discarded && identity.ranBundleSha256 !== bundleSha256;
}

function progressLine(record: RunRecord, position: string, eta: string): string {
	const { identity } = record;
	const label = identity.discarded ? 'warm-up' : identity.kind;
	const numbers = METRICS.filter((m) => PROGRESS_METRICS.includes(m.key)).flatMap((m) => {
		const value = m.read(record);

		return value === undefined
			? []
			: [`${m.key.replace(/_(ms|mb)$/, '')} ${formatValue(value, m.unit)}`];
	});
	const ran = identity.discarded ? ` ran ${identity.ranBundleSha256?.slice(0, 8) ?? 'none'}` : '';
	const status = record.problems.length > 0 ? `INVALID: ${record.problems.join('; ')}` : 'ok';

	return `[${position}] ${identity.variant} ${label}${ran}  ${numbers.join('  ')}  ${status}  ${eta}`;
}

/**
 * @description Runs the plan's blocks on the prepared device, appending each launch as it finishes. Stops at the
 * first launch that misses a milestone, crashes or fails its self-check, unless it is a warm-up on a stale bundle.
 * @param context The device, bridge and protocol.
 * @param plan The plan.
 * @param builds Each variant's build, by variant name.
 * @param emit Receives each launch record as soon as it exists.
 * @param print Prints one progress line per launch.
 */
export async function runBlocks(
	context: LaunchContext,
	plan: Plan,
	builds: Map<string, VariantBuild>,
	emit: (record: RunRecord) => void,
	print: (line: string) => void,
): Promise<void> {
	const blocks = schedule(plan);
	const urls = new Map(
		[...builds.values()].map((build) => [build.variant, publishBuild(context.server, build)]),
	);
	const expected = blocks.reduce((sum, block) => sum + block.warm + block.cold + 2, 0);
	const startedAt = Date.now();
	let index = 0;

	async function launch(spec: Omit<LaunchSpec, 'index'>): Promise<RunRecord> {
		const record = await runLaunch(context, { ...spec, index: ++index });
		const perLaunch = (Date.now() - startedAt) / index;
		const eta = `~${Math.max(0, Math.round((perLaunch * (expected - index)) / 60_000))} min left`;

		emit(record);
		print(progressLine(record, `${index}/~${expected}`, eta));

		if (
			record.problems.length > 0 &&
			!ranStaleBundle(record.identity, spec.build.bundleSha256)
		) {
			throw new Error(
				`Launch ${index} (${spec.build.variant}, ${spec.discarded ? 'warm-up' : spec.kind}) is invalid: ${record.problems.join('; ')}`,
			);
		}

		return record;
	}

	for (const block of blocks) {
		const build = builds.get(block.variant.name)!;

		context.server.serveBundle(join(build.dir, 'bundle'));
		await context.vphone.stopDiscord();
		await context.vphone.shell(
			installScript(build, context.paths, urls.get(build.variant)!, context.addons),
		);

		for (let warmups = 1; ; warmups++) {
			const record = await launch({ build, kind: 'warm', discarded: true });

			if (record.identity.ranBundleSha256 === build.bundleSha256) {
				break;
			}

			if (warmups >= MAX_WARMUPS) {
				throw new Error(
					`${build.variant} never ran its bundle after ${MAX_WARMUPS} launches; the loader kept ${record.identity.ranBundleSha256 ?? 'none'}.`,
				);
			}
		}

		const kinds: LaunchKind[] = [
			...Array<LaunchKind>(block.warm).fill('warm'),
			...Array<LaunchKind>(block.cold).fill('cold'),
		];

		for (const kind of kinds) await launch({ build, kind, discarded: false });
	}
}

export default { prepareDevice, restoreDevice, runBlocks };
