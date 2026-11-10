import type { PluginSelfTestResult } from '@unbound-app/api/global';
import type { PluginContext } from '@unbound-app/api/native';

/** The self-test report a plugin returns, the one shape the device matrix reads through `plugins.selfTest(id)`. */
export type SelfTestResult = PluginSelfTestResult;

/** Ends one feature; a promise for native work that must finish before the plugin's native scope closes. */
export type Cleanup = () => void | Promise<void>;

type Started = Cleanup | void;

/** Starts one feature and may return the function that ends it, or a promise of it that `start` waits for; a throw or rejection is the feature failing to start. */
export type Feature = (context: PluginContext) => Started | Promise<Started>;

/** The features to run, or a function that checks what they need and returns them, or nothing to start none. */
export type Features = Feature[] | ((context: PluginContext) => Feature[] | undefined);

type RunOptions<R> = {
	/** Starts all features or none: one that throws reverts those already started. Use it when they depend on each other. */
	atomic?: boolean;
	/** Builds the plugin's self test from the features' own result, such as {@link drawnSelfTest}. */
	selfTest?: (features: SelfTestResult) => R;
};

/** The plugin entry's lifecycle: export all three from `src/index.tsx`. */
export type FeatureRunner<R> = {
	/** Resolves once every asynchronous feature has started; returns nothing when all are synchronous. */
	start: (context: PluginContext) => Promise<void> | undefined;
	stop: () => Promise<void> | undefined;
	selfTest: () => R;
};

type Run = {
	cleanups: Cleanup[];
	running: number;
	failures: string[];
	reverted: boolean;
	skips: Set<string>;
	waits: { module: string; loaded: () => boolean }[];
};

// The run that `skipFeature` records into; one per plugin, since every plugin bundles its own copy of this module.
let current: Run | undefined;

function isPending<T>(result: T | Promise<T>): result is Promise<T> {
	return typeof (result as Promise<T> | undefined)?.then === 'function';
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

// Ends the cleanups in reverse, logging each that throws; resolves once the asynchronous ones finish.
function endAll(cleanups: Cleanup[]): Promise<void> | undefined {
	const pending: Promise<void>[] = [];

	for (const cleanup of cleanups.splice(0).reverse()) {
		try {
			const result = cleanup();

			if (isPending(result)) {
				pending.push(result);
			}
		} catch (error) {
			logger.error('Failed to clean up a feature:', error);
		}
	}

	if (!pending.length) return;

	return Promise.allSettled(pending).then((results) => {
		for (const result of results) {
			if (result.status === 'rejected') {
				logger.error('Failed to clean up a feature:', result.reason);
			}
		}
	});
}

// Counts a started feature in, or ends it at once when the run stopped or reverted while it was starting.
function adopt(run: Run, cleanup: Started) {
	if (current !== run || run.reverted) {
		if (cleanup) {
			void endAll([cleanup]);
		}

		return;
	}

	run.running++;

	if (cleanup) {
		run.cleanups.push(cleanup);
	}
}

// UNKNOWN: a feature may throw or reject with any value.
function fail(run: Run, error: unknown, atomic: boolean) {
	run.failures.push(messageOf(error));

	if (!atomic) {
		logger.error('Failed to start a feature:', error);

		return;
	}

	run.reverted = true;
	run.running = 0;
	void endAll(run.cleanups);
	logger.error('Failed to start, reverted:', error);
}

function startAll(
	run: Run,
	features: Feature[],
	context: PluginContext,
	atomic: boolean,
): Promise<void> | undefined {
	const pending: Promise<void>[] = [];

	for (const feature of features) {
		if (run.reverted) {
			break;
		}

		try {
			const started = feature(context);

			if (isPending(started)) {
				pending.push(
					started.then(
						(cleanup) => adopt(run, cleanup),
						(error) => fail(run, error, atomic),
					),
				);
			} else {
				adopt(run, started);
			}
		} catch (error) {
			fail(run, error, atomic);
		}
	}

	if (!pending.length) return;

	return Promise.all(pending).then(() => undefined);
}

function healthOf(run: Run | undefined): SelfTestResult {
	if (run?.failures.length) {
		return { ok: false, detail: `start failed and was reverted: ${run.failures.join('; ')}` };
	}

	if (run?.skips.size) {
		return { ok: false, detail: `skipped: ${[...run.skips].join('; ')}` };
	}

	if (!run?.running) {
		return { ok: false, detail: 'no features are applied' };
	}

	const applied = `${run.running} feature${run.running === 1 ? '' : 's'} applied`;
	const waiting = new Set(run.waits.filter((wait) => !wait.loaded()).map((wait) => wait.module));

	return {
		ok: true,
		detail: waiting.size ? `${applied}, waiting for ${[...waiting].join(', ')}` : applied,
	};
}

/**
 * @description Runs a plugin's features as its `start`, `stop` and `selfTest`, named and logged through the Addon scope.
 * Each feature starts on its own unless `atomic`; `stop` ends them in reverse, and the self test counts what is running
 * and names the modules features still wait for, since Discord loads some only on interaction.
 * @template R The self test's result.
 * @param features The features, or a function returning them once what they share is checked and built.
 * @param options `atomic` to start all or none, and `selfTest` to build on the features' result.
 * @returns The entry's `start`, `stop` and `selfTest`; export them from `src/index.tsx` as they are.
 */
export function runFeatures<R = SelfTestResult>(
	features: Features,
	{ atomic = false, selfTest }: RunOptions<R> = {},
): FeatureRunner<R> {
	return {
		start(context) {
			const run: Run = {
				cleanups: [],
				running: 0,
				failures: [],
				reverted: false,
				skips: new Set(),
				waits: [],
			};

			current = run;

			let list: Feature[] | undefined;

			// Nothing has started yet, so `start` fails as a whole, as Unbound reports it.
			try {
				list = typeof features === 'function' ? features(context) : features;
			} catch (error) {
				run.failures.push(messageOf(error));
				throw error;
			}

			return list && startAll(run, list, context, atomic);
		},
		stop() {
			const run = current;

			current = undefined;

			return run && endAll(run.cleanups);
		},
		selfTest() {
			const result = healthOf(current);

			return selfTest ? selfTest(result) : (result as R);
		},
	};
}

/**
 * @description Starts parts of one feature that depend on each other, all of them or none, such as a renderer and its hooks.
 * @param parts Functions that each start one part and may return the function that ends it, in start order.
 * @returns A function that ends the parts in reverse, resolving once their cleanup finishes; throws after reverting when one fails to start.
 */
export function startTogether(parts: (() => Cleanup | void)[]): () => Promise<void> | undefined {
	const cleanups: Cleanup[] = [];

	try {
		for (const part of parts) {
			const cleanup = part();

			if (cleanup) {
				cleanups.push(cleanup);
			}
		}
	} catch (error) {
		void endAll(cleanups);
		throw error;
	}

	return () => endAll(cleanups);
}

/**
 * @description Logs that the plugin, or one of its features, skipped starting, and fails the running plugin's self test with the reason.
 * @param reason Why it skipped, such as `modules not found: MessageStore`.
 */
export function skipFeature(reason: string): void {
	logger.error(`Skipped, ${reason}.`);
	current?.skips.add(reason);
}

/**
 * @description Names `module` in the running plugin's self test detail until `loaded` reports the module a deferred patch needs as loaded.
 * @param module The module's name or source path.
 * @param loaded Reads whether the module has loaded, so the deferred patch applied.
 */
export function awaitModule(module: string, loaded: () => boolean): void {
	current?.waits.push({ module, loaded });
}

/**
 * @description Logs and records a skip when any of the things a feature needs are missing.
 * @param missing The names of what is missing.
 * @param what What they are, such as `modules not found`.
 * @param feature The feature that needs them, when not the whole plugin.
 * @returns `true` when nothing is missing.
 */
export function ensurePresent(missing: string[], what: string, feature?: string): boolean {
	if (!missing.length) {
		return true;
	}

	skipFeature(`${feature ? `${feature}: ` : ''}${what}: ${missing.join(', ')}`);

	return false;
}

/**
 * @description Builds a self test that passes only once the plugin drew something, for the device matrix, which opens fixture messages first.
 * @param features The features' own result, which a failure keeps.
 * @param drawn How many things the plugin has drawn on screen, or `undefined` when it never started drawing.
 * @param noun What it draws, plural, such as `embeds`.
 * @param settling Reads whether the plugin is still drawing what is on screen.
 * @returns `ok` when the features run and at least one thing is drawn.
 */
export function drawnSelfTest(
	features: SelfTestResult,
	drawn: (() => number) | undefined,
	noun: string,
	settling?: () => boolean,
): SelfTestResult {
	if (!features.ok) {
		return features;
	}

	const count = drawn?.() ?? 0;

	return count > 0
		? {
				ok: true,
				detail: `${count} ${noun} drawn on screen`,
				...(settling?.() ? { settling: true } : {}),
			}
		: { ok: false, detail: `no ${noun} are drawn on screen`, nothingDrawn: true };
}

export default {
	runFeatures,
	startTogether,
	skipFeature,
	awaitModule,
	ensurePresent,
	drawnSelfTest,
};
