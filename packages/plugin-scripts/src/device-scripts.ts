import type { PluginSelfTestResult } from '@unbound-app/api/global';

import { deviceScript } from './device-script';
import { Type, type Static } from '@unbound-app/contracts/schema';

export const cycleResultSchema = Type.Object({
	id: Type.String(),
	installed: Type.Boolean(),
	wasStarted: Type.Boolean(),
	error: Type.String(),
	restarted: Type.Boolean(),
	updateError: Type.String(),
	updated: Type.Boolean(),
	hooksBefore: Type.Number(),
	hooksStopped: Type.Number(),
	hooksAfter: Type.Number(),
	hooksUpdated: Type.Number(),
	stopMs: Type.Optional(Type.Number()),
	startMs: Type.Optional(Type.Number()),
	drawnMs: Type.Optional(Type.Number()),
	selfTest: Type.Optional(Type.Object({ ok: Type.Boolean(), detail: Type.String() })),
	bundleHash: Type.Optional(Type.String()),
});

export type CycleResult = Static<typeof cycleResultSchema>;

const CYCLE_SETTLE_MS = 300;
const SELF_TEST_DELAY_MS = 2_500;
const DRAWN_POLL_MS = 200;

/** The log lines {@link pluginLogScript} and {@link toastLogScript} return. */
export const logLinesSchema = Type.Array(Type.String());

/**
 * @description Whether a plugin's self-test says it finished drawing: it works, drew something and is no longer settling. The device scripts get it as an argument.
 * @param report The plugin's report, if it has a self-test.
 * @returns `true` once the plugin has drawn.
 */
export function isDrawn(report: PluginSelfTestResult | undefined): boolean {
	return Boolean(report?.ok && !report.nothingDrawn && !report.settling);
}

function runCycle(
	id: string,
	settleMs: number,
	selfTestDelayMs: number,
	drawnPollMs: number,
	drawn: typeof isDrawn,
) {
	const manager = unbound.plugins;
	const read = unbound.native?.getNativeResources;
	const hooks = () => read?.()?.hooks ?? 0;
	const settle = () => new Promise((resolve) => setTimeout(resolve, settleMs));
	const message = (failure: unknown) =>
		String(failure && (failure as Error).message ? (failure as Error).message : failure);
	let entity = manager.get(id) as DeviceAddon | undefined;
	const result: CycleResult = {
		id,
		installed: Boolean(entity),
		wasStarted: Boolean(entity?.started),
		error: '',
		restarted: false,
		updateError: '',
		updated: false,
		hooksBefore: 0,
		hooksStopped: 0,
		hooksAfter: 0,
		hooksUpdated: 0,
	};

	return (async () => {
		if (!entity) return JSON.stringify(result);

		if (typeof entity.bundle === 'string') {
			let hash = 0x811c9dc5;

			for (let index = 0; index < entity.bundle.length; index++) {
				hash = Math.imul(hash ^ entity.bundle.charCodeAt(index), 0x01000193);
			}

			result.bundleHash = `${(hash >>> 0).toString(16)}:${entity.bundle.length}`;
		}

		if (!result.wasStarted) {
			try {
				await manager.start(id);
			} catch (failure) {
				result.error = message(failure);
			}

			await settle();
		}

		const before = manager.errors.get(id);

		result.hooksBefore = hooks();

		const stopping = Date.now();

		try {
			await manager.stop(id);
		} catch (failure) {
			result.error = result.error || message(failure);
		}

		result.stopMs = Date.now() - stopping;
		result.hooksStopped = hooks();

		const starting = Date.now();

		try {
			await manager.start(id);
		} catch (failure) {
			result.error = result.error || message(failure);
		}

		result.startMs = Date.now() - starting;
		await settle();

		const after = manager.errors.get(id);

		if (!result.error && after && after !== before) result.error = message(after);

		entity = manager.get(id) as DeviceAddon | undefined;
		result.restarted = Boolean(entity?.started);
		result.hooksAfter = hooks();

		let watching = false;

		async function watchDrawn(since: number) {
			while (watching) {
				try {
					if (drawn(await manager.selfTest(id))) {
						result.drawnMs = Date.now() - since;

						return;
					}
				} catch {
					// A self-test that throws mid-reload is judged by the final self-test below; keep polling until then.
				}

				await new Promise((resolve) => setTimeout(resolve, drawnPollMs));
			}
		}

		let drawing: Promise<void> = Promise.resolve();

		if (result.restarted && entity) {
			const reloading = Date.now();

			try {
				const update = await manager.reload(id, entity.bundle, entity.manifest);

				watching = true;
				drawing = watchDrawn(reloading);

				if (!update.ok) result.updateError = message(update.error);
			} catch (failure) {
				result.updateError = message(failure);
			}

			await settle();
		}

		const updated = manager.get(id);

		result.updated = Boolean(updated?.started);
		result.hooksUpdated = hooks();
		await Promise.race([
			drawing,
			new Promise((resolve) => setTimeout(resolve, selfTestDelayMs)),
		]);
		watching = false;
		await drawing;

		if (result.drawnMs !== undefined) await settle();

		if (result.updated) {
			try {
				const report = await manager.selfTest(id);

				if (report) result.selfTest = { ok: report.ok, detail: report.detail };
			} catch (failure) {
				result.selfTest = { ok: false, detail: message(failure) };
			}
		}

		return JSON.stringify(result);
	})();
}

/**
 * @description Stops, starts and reloads a plugin on the device, counting its native hooks at each step and running its self-test after.
 * @param id The plugin's id.
 * @returns A script whose result is the {@link CycleResult} as JSON.
 */
export function cycleScript(id: string): string {
	return deviceScript(runCycle, id, CYCLE_SETTLE_MS, SELF_TEST_DELAY_MS, DRAWN_POLL_MS, isDrawn);
}

function setDeveloperMode(enabled: boolean) {
	const store = unbound.storage.getBucket('unbound');
	const previous = store.get('developer-mode', false);

	store.set('developer-mode', enabled);

	return String(previous);
}

export function developerModeScript(enabled: boolean): string {
	return deviceScript(setDeveloperMode, enabled);
}

/** The {@link PluginSelfTestResult} each plugin reports, by id. */
export const selfTestReportsSchema = Type.Record(
	Type.String(),
	Type.Object({
		ok: Type.Boolean(),
		detail: Type.String(),
		nothingDrawn: Type.Optional(Type.Boolean()),
		settling: Type.Optional(Type.Boolean()),
	}),
	{ additionalProperties: false },
);

function runSelfTests() {
	const reports: Record<string, PluginSelfTestResult> = {};
	const message = (failure: unknown) =>
		String(failure && (failure as Error).message ? (failure as Error).message : failure);

	return (async () => {
		for (const entity of unbound.plugins.entities.values()) {
			try {
				const report = await unbound.plugins.selfTest(entity.id);

				if (report) reports[entity.id] = report;
			} catch (failure) {
				reports[entity.id] = { ok: false, detail: message(failure) };
			}
		}

		return JSON.stringify(reports);
	})();
}

/**
 * @description Runs the self-test of every running plugin, such as after the matrix scrolled the chat, where cells are reused and stale drawing shows up.
 * @returns A script whose result is each plugin's report by id, as JSON.
 */
export function selfTestsScript(): string {
	return deviceScript(runSelfTests);
}

export const redrawTimesSchema = Type.Record(Type.String(), Type.Number(), {
	additionalProperties: false,
});

function timeRedraws(limitMs: number, pollMs: number, drawn: typeof isDrawn) {
	const started = Date.now();
	const times: Record<string, number> = {};
	const waiting = [...unbound.plugins.entities.values()]
		.filter((entity) => entity.started)
		.map((entity) => entity.id);

	return (async () => {
		while (waiting.length && Date.now() - started < limitMs) {
			for (let index = waiting.length - 1; index >= 0; index--) {
				const id = waiting[index]!;

				try {
					const report = await unbound.plugins.selfTest(id);

					if (!report || drawn(report)) {
						if (report) times[id] = Date.now() - started;

						waiting.splice(index, 1);
					}
				} catch {
					waiting.splice(index, 1);
				}
			}

			await new Promise((resolve) => setTimeout(resolve, pollMs));
		}

		return JSON.stringify(times);
	})();
}

export function redrawTimesScript(limitMs: number): string {
	return deviceScript(timeRedraws, limitMs, DRAWN_POLL_MS, isDrawn);
}

export const MATRIX_TOAST_MS = 300;

/**
 * @description Sets how long Unbound's toasts stay on screen, so the matrix's screenshots are not covered by the toast each plugin reload shows.
 * @param milliseconds The duration to set, or `null` to remove the setting.
 * @returns A script whose result is the previous value as JSON, `null` when unset.
 */
function setToastDuration(milliseconds: number | null) {
	const store = unbound.storage.getBucket('unbound');
	const previous = store.get('toasts.duration', null);

	if (milliseconds === null) store.remove('toasts.duration');
	else store.set('toasts.duration', milliseconds);

	return JSON.stringify(previous);
}

export function toastDurationScript(milliseconds: number | null): string {
	return deviceScript(setToastDuration, milliseconds);
}

function logLines(path: string, needles: string[]) {
	return Promise.resolve(unbound.fs.readFile(path)).then(
		(text) =>
			JSON.stringify(
				String(text)
					.split('\n')
					.filter((line) => needles.some((needle) => line.includes(needle))),
			),
		() => '[]',
	);
}

const LOG_PATH = 'Unbound/Logs/unbound.log';

export function pluginLogScript(): string {
	return deviceScript(logLines, LOG_PATH, [
		'off the main thread',
		' E [',
		'Native plugin hook skipped in',
	]);
}

function readPluginsSettled() {
	const settled = [...unbound.plugins.entities.values()].every(
		(entity) => !entity.isEnabled() || entity.started || entity.failed,
	);

	return settled ? 'settled' : 'starting';
}

/**
 * @description Reads whether every enabled plugin has started or failed, as it has once Discord finished launching.
 * @returns A script whose result is `settled` or `starting`.
 */
export function pluginsSettledScript(): string {
	return deviceScript(readPluginsSettled);
}

function stopPlugin(id: string) {
	return Promise.resolve(unbound.plugins.stop(id)).then(() => 'stopped');
}

export function restoreScript(id: string): string {
	return deviceScript(stopPlugin, id);
}

export function toastLogScript(): string {
	return deviceScript(logLines, LOG_PATH, ['[Toasts]']);
}
