import { watch, type FSWatcher } from 'node:fs';
import { resolve, sep } from 'node:path';

import type { AddonDiagnostics } from '~/lib/check/run';
import type { DiscoveredAddon } from '~/lib/discovery';
import type { Diagnostic } from '~/rollup/diagnostic';

/** How long the saves inside one addon settle before its checks re-run. */
const DEBOUNCE_MS = 100;

const IGNORED_SEGMENTS = ['node_modules', '.git'];

/** What one run changed: the diagnostics that appeared and the ones that went away. */
export type DiagnosticChanges = {
	added: AddonDiagnostics[];
	removed: AddonDiagnostics[];
};

/** A finished run: every addon's current diagnostics, and what changed since the run before. */
export type WatchUpdate = DiagnosticChanges & {
	results: AddonDiagnostics[];
	initial: boolean;
};

export type WatchOptions = {
	addons: readonly DiscoveredAddon[];
	/** Checks the given addons; the watcher passes one addon per re-run. */
	check: (addons: readonly DiscoveredAddon[]) => Promise<AddonDiagnostics[]>;
	onUpdate: (update: WatchUpdate) => void;
	debounceMs?: number;
};

export type CheckWatcher = {
	stop: () => void;
};

function keyOf(diagnostic: Diagnostic): string {
	const { check, file, line, column, path, severity, message, fix } = diagnostic;

	return JSON.stringify([check, file, line, column, path, severity, message, fix]);
}

/**
 * @description Compares an addon's diagnostics before and after a run.
 * @param before The previous run's diagnostics.
 * @param after This run's diagnostics.
 * @returns The diagnostics only `after` has, and the ones only `before` has.
 */
export function diffDiagnostics(
	before: AddonDiagnostics,
	after: AddonDiagnostics,
): DiagnosticChanges {
	const previous = new Set(before.diagnostics.map(keyOf));
	const next = new Set(after.diagnostics.map(keyOf));

	return {
		added: [
			{
				addon: after.addon,
				diagnostics: after.diagnostics.filter((d) => !previous.has(keyOf(d))),
			},
		],
		removed: [
			{
				addon: before.addon,
				diagnostics: before.diagnostics.filter((d) => !next.has(keyOf(d))),
			},
		],
	};
}

function isIgnored(path: string, addon: DiscoveredAddon): boolean {
	const segments = path.split(sep);

	if (IGNORED_SEGMENTS.some((segment) => segments.includes(segment))) {
		return true;
	}

	return !addon.static && (path === addon.output || path.startsWith(`${addon.output}${sep}`));
}

/**
 * @description Checks the addons, then re-checks one whenever a file in it is saved, reporting each
 * run with what changed. Runs of one addon never overlap: a save during a run queues one more.
 * @param options The addons, how to check them, and where to send each run.
 * @returns The watcher, after the first run reported.
 */
export async function watchChecks({
	addons,
	check,
	onUpdate,
	debounceMs = DEBOUNCE_MS,
}: WatchOptions): Promise<CheckWatcher> {
	const current = new Map<string, AddonDiagnostics>();
	const timers = new Map<string, ReturnType<typeof setTimeout>>();
	const running = new Map<string, Promise<void>>();
	const dirty = new Set<string>();
	const watchers: FSWatcher[] = [];

	for (const result of await check(addons)) current.set(result.addon.dir, result);

	const results = () => [...current.values()];

	onUpdate({ results: results(), added: results(), removed: [], initial: true });

	async function rerun(addon: DiscoveredAddon) {
		const [after] = await check([addon]);
		const before = current.get(addon.dir);

		if (!after || !before) return;

		current.set(addon.dir, after);
		onUpdate({ ...diffDiagnostics(before, after), results: results(), initial: false });
	}

	function start(addon: DiscoveredAddon) {
		if (running.has(addon.dir)) {
			dirty.add(addon.dir);

			return;
		}

		const run = rerun(addon).finally(() => {
			running.delete(addon.dir);

			if (dirty.delete(addon.dir)) {
				start(addon);
			}
		});

		running.set(addon.dir, run);
	}

	function schedule(addon: DiscoveredAddon) {
		clearTimeout(timers.get(addon.dir));
		timers.set(
			addon.dir,
			setTimeout(() => {
				timers.delete(addon.dir);
				start(addon);
			}, debounceMs),
		);
	}

	for (const addon of addons) {
		watchers.push(
			watch(addon.dir, { recursive: true }, (_event, filename) => {
				if (filename && !isIgnored(resolve(addon.dir, filename), addon)) {
					schedule(addon);
				}
			}),
		);
	}

	return {
		stop() {
			for (const watcher of watchers) watcher.close();

			for (const timer of timers.values()) clearTimeout(timer);

			timers.clear();
		},
	};
}

export default { diffDiagnostics, watchChecks };
