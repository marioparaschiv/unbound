import { z } from '@unbound-app/contracts/zod';

import { deviceScript } from './device-script';

export const SELF_TEST_MARKER = 'loader self-test';

export type SelfTestResult = { ok: boolean; detail: string };

/** What the finish and cancellation scripts return. */
export const selfTestCountsSchema = z.object({
	host: z.optional(z.string()),
	platform: z.optional(z.string()),
	base: z.optional(z.number()),
	derived: z.optional(z.number()),
	error: z.optional(z.string()),
	cancellations: z.optional(z.record(z.string(), z.string())),
});

export type SelfTestCounts = z.infer<typeof selfTestCountsSchema>;

/**
 * @description Installs the self-test hooks through the first running plugin that can hook natively: on iOS a superclass and subclass hook on the same selector, one of which throws once, and on Android a Java hook whose listener throws once.
 * @returns A script whose result is the host plugin's name, or an `error:` message.
 */
type SelfTestState = {
	base: number;
	derived: number;
	thrown: boolean;
	tokens: unknown[];
	platform?: string;
	host?: string;
	remove?: () => void;
};

type SelfTestGlobal = typeof globalThis & { __unboundSelfTest?: SelfTestState };

function startSelfTest(marker: string) {
	const entities = [...unbound.plugins.entities.values()].filter(
		(entity) => entity.started && entity.context?.native,
	);
	const can = (entity: DeviceEntity, platform: string, capability: string) =>
		entity.context?.platform === platform &&
		(entity.context.capabilities ?? []).includes(capability);
	const ios = entities.find((entity) => can(entity, 'ios', 'native.objc.hooks'));
	const android = entities.find((entity) => can(entity, 'android', 'native.java.hooks'));
	const state: SelfTestState = { base: 0, derived: 0, thrown: false, tokens: [] };
	const throwOnce = () => {
		if (!state.thrown) {
			state.thrown = true;
			throw new Error(marker);
		}
	};

	(globalThis as SelfTestGlobal).__unboundSelfTest = state;

	if (ios?.context?.native) {
		const { objc } = ios.context.native;
		const tokens = [
			objc.hook('UIView', 'layoutSubviews', {
				after: () => {
					state.base++;
					throwOnce();
				},
			}),
			objc.hook('UIScrollView', 'layoutSubviews', {
				after: () => {
					state.derived++;
				},
			}),
		];

		state.platform = 'ios';
		state.host = ios.data.name;
		state.tokens = tokens;
		state.remove = () => tokens.forEach((token) => token.remove());

		return state.host;
	}

	if (android?.context?.native) {
		const { hooks } = android.context.native;

		state.platform = 'android';
		state.host = android.data.name;
		state.tokens.push(
			hooks.hook('android.view.View', 'onAttachedToWindow', [], { notify: true }, () => {
				state.base++;
				throwOnce();
			}),
		);
		state.remove = () => state.tokens.forEach((token) => hooks.remove(token));

		return state.host;
	}

	return 'error: no running plugin can install native hooks';
}

export function selfTestStartScript(): string {
	return deviceScript(startSelfTest, SELF_TEST_MARKER);
}

/**
 * @description Removes the self-test hooks and reports how often they fired.
 * @returns A script whose result is the JSON counts.
 */
function finishSelfTest() {
	const scope = globalThis as SelfTestGlobal;
	const state = scope.__unboundSelfTest;

	if (!state) return JSON.stringify({ error: 'the self-test never started' });

	state.remove?.();
	delete scope.__unboundSelfTest;

	return JSON.stringify({
		host: state.host,
		platform: state.platform,
		base: state.base,
		derived: state.derived,
	});
}

export function selfTestFinishScript(): string {
	return deviceScript(finishSelfTest);
}

/**
 * @description Runs native calls that end early through the self-test host: one cancelled straight away, one still queued when the host stops (the host is started again after), and on Android one made on a released handle to an object the test constructs itself, since releasing a shared handle would revoke it for every plugin.
 * @returns A script whose result is the JSON outcome of each case: `resolved`, `cancellation`, or `other: <message>`.
 */
function runCancellations(trackerClass: string) {
	const entities = [...unbound.plugins.entities.values()].filter(
		(entity) => entity.started && entity.context?.native,
	);
	const can = (entity: DeviceEntity, platform: string, capability: string) =>
		entity.context?.platform === platform &&
		(entity.context.capabilities ?? []).includes(capability);
	const host =
		entities.find((entity) => can(entity, 'ios', 'native.objc.invoke')) ??
		entities.find((entity) => can(entity, 'android', 'native.java.invoke'));

	if (!host?.context?.native)
		return Promise.resolve(
			JSON.stringify({ error: 'no running plugin can make native calls' }),
		);

	const classify = (error: unknown) => {
		const text = String(error && (error as Error).message ? (error as Error).message : error);
		const coded = (error as { code?: string } | null)?.code === 'NATIVE_PLUGIN_SCOPE_DISPOSED';

		return coded || /cancel|disposed|unavailable/i.test(text)
			? 'cancellation'
			: `other: ${text}`;
	};
	const settle = (call: Promise<unknown>) => call.then(() => 'resolved', classify);
	const native = host.context.native;
	const ios = host.context.platform === 'ios';
	const target = ios
		? native.objc.call(native.objc.getClass('UIApplication'), 'sharedApplication')
		: native.java.getField(native.java.getClass(trackerClass), 'INSTANCE');
	const call = (handle: DeviceHandle) =>
		ios
			? native.objc.invokeAsync(handle, 'description', [])
			: native.java.invokeAsync(handle, 'toString', []);
	const outcomes: Record<string, string> = {};

	return (async () => {
		const cancelled = call(target);

		cancelled.cancel();
		outcomes.cancelled = await settle(cancelled);

		if (!ios) {
			const released = native.java.construct('java.lang.Object', []);

			native.java.release(released);

			try {
				outcomes.released = await settle(call(released));
			} catch (error) {
				outcomes.released = classify(error);
			}
		}

		const queued = call(target);
		const stopping = unbound.plugins.stop(host.id);

		outcomes.stopped = await settle(queued);
		await stopping;
		await unbound.plugins.start(host.id);

		return JSON.stringify({ host: host.data.name, cancellations: outcomes });
	})();
}

export function selfTestCancellationScript(): string {
	return deviceScript(runCancellations, 'app.unbound.android.ActivityTracker');
}

/**
 * @description Judges the self-test from its counts and the plugin errors logged meanwhile.
 * @param counts What the hooks recorded.
 * @param errors Logged plugin errors by plugin name.
 * @returns Whether the loader passed, with the reason.
 */
export function judgeSelfTest(
	counts: SelfTestCounts,
	errors: Map<string, string[]>,
): SelfTestResult {
	if (counts.error) return { ok: false, detail: counts.error };

	if (!counts.base) return { ok: false, detail: 'the self-test hook never fired' };

	if (counts.platform === 'ios' && !counts.derived) {
		return { ok: false, detail: 'the subclass hook never fired alongside its superclass hook' };
	}

	const attributed = (errors.get(counts.host ?? '') ?? []).some((error) =>
		error.includes(SELF_TEST_MARKER),
	);

	if (!attributed) {
		return { ok: false, detail: `the thrown hook error was not logged against ${counts.host}` };
	}

	const wrong = Object.entries(counts.cancellations ?? {}).filter(
		([, outcome]) => outcome !== 'resolved' && outcome !== 'cancellation',
	);

	if (wrong.length) {
		return {
			ok: false,
			detail: `native work ended early did not end as a cancellation: ${wrong.map(([name, outcome]) => `${name} ${outcome}`).join('; ')}`,
		};
	}

	const logged = (errors.get(counts.host ?? '') ?? []).filter(
		(error) => !error.includes(SELF_TEST_MARKER),
	);

	if (logged.length) {
		return { ok: false, detail: `cancelled native work was logged as an error: ${logged[0]}` };
	}

	const chain = counts.platform === 'ios' ? `, subclass ${counts.derived}` : '';
	const outcomes = Object.entries(counts.cancellations ?? {}).map(
		([name, outcome]) => `${name} ${outcome}`,
	);
	const ended = outcomes.length ? `; early endings: ${outcomes.join(', ')}` : '';

	return {
		ok: true,
		detail: `hooks fired (base ${counts.base}${chain}) and the error named ${counts.host}${ended}`,
	};
}
