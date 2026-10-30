import { z } from '@unbound-app/contracts/zod';

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
export function selfTestStartScript(): string {
	return `(function () {
	var marker = ${JSON.stringify(SELF_TEST_MARKER)};
	var entities = [...unbound.plugins.entities.values()].filter(function (entity) { return entity.started && entity.context && entity.context.native; });
	var can = function (entity, platform, capability) { return entity.context.platform === platform && (entity.context.capabilities || []).indexOf(capability) !== -1; };
	var ios = entities.find(function (entity) { return can(entity, 'ios', 'native.objc.hooks'); });
	var android = entities.find(function (entity) { return can(entity, 'android', 'native.java.hooks'); });
	var state = { base: 0, derived: 0, thrown: false, tokens: [] };
	globalThis.__unboundSelfTest = state;
	var throwOnce = function () { if (!state.thrown) { state.thrown = true; throw new Error(marker); } };
	if (ios) {
		var objc = ios.context.native.objc;
		state.platform = 'ios';
		state.host = ios.data.name;
		state.tokens.push(objc.hook('UIView', 'layoutSubviews', { after: function () { state.base++; throwOnce(); } }));
		state.tokens.push(objc.hook('UIScrollView', 'layoutSubviews', { after: function () { state.derived++; } }));
		state.remove = function () { state.tokens.forEach(function (token) { token.remove(); }); };
		return state.host;
	}
	if (android) {
		var hooks = android.context.native.hooks;
		state.platform = 'android';
		state.host = android.data.name;
		state.tokens.push(hooks.hook('android.view.View', 'onAttachedToWindow', [], { notify: true }, function () { state.base++; throwOnce(); }));
		state.remove = function () { state.tokens.forEach(function (token) { hooks.remove(token); }); };
		return state.host;
	}
	return 'error: no running plugin can install native hooks';
})()`;
}

/**
 * @description Removes the self-test hooks and reports how often they fired.
 * @returns A script whose result is the JSON counts.
 */
export function selfTestFinishScript(): string {
	return `(function () {
	var state = globalThis.__unboundSelfTest;
	if (!state) return JSON.stringify({ error: 'the self-test never started' });
	state.remove();
	delete globalThis.__unboundSelfTest;
	return JSON.stringify({ host: state.host, platform: state.platform, base: state.base, derived: state.derived });
})()`;
}

/**
 * @description Runs native calls that end early through the self-test host: one cancelled straight away, one still queued when the host stops (the host is started again after), and on Android one made on a released handle.
 * @returns A script whose result is the JSON outcome of each case: `resolved`, `cancellation`, or `other: <message>`.
 */
export function selfTestCancellationScript(): string {
	return `(async function () {
	var entities = [...unbound.plugins.entities.values()].filter(function (entity) { return entity.started && entity.context && entity.context.native; });
	var can = function (entity, platform, capability) { return entity.context.platform === platform && (entity.context.capabilities || []).indexOf(capability) !== -1; };
	var host = entities.find(function (entity) { return can(entity, 'ios', 'native.objc.invoke'); }) || entities.find(function (entity) { return can(entity, 'android', 'native.java.invoke'); });
	if (!host) return JSON.stringify({ error: 'no running plugin can make native calls' });
	var classify = function (error) {
		var text = String(error && error.message ? error.message : error);
		return error && (error.code === 'NATIVE_PLUGIN_SCOPE_DISPOSED' || /cancel|disposed|unavailable/i.test(text)) ? 'cancellation' : 'other: ' + text;
	};
	var settle = function (call) { return call.then(function () { return 'resolved'; }, classify); };
	var native = host.context.native;
	var ios = host.context.platform === 'ios';
	var target = ios
		? native.objc.call(native.objc.getClass('UIApplication'), 'sharedApplication')
		: native.java.getField(native.java.getClass('app.unbound.android.ActivityTracker'), 'INSTANCE');
	var call = function (handle) { return ios ? native.objc.invokeAsync(handle, 'description', []) : native.java.invokeAsync(handle, 'toString', []); };
	var outcomes = {};
	var cancelled = call(target);
	cancelled.cancel();
	outcomes.cancelled = await settle(cancelled);
	if (!ios) {
		var released = native.java.getField(native.java.getClass('app.unbound.android.ActivityTracker'), 'INSTANCE');
		native.java.release(released);
		try { outcomes.released = await settle(call(released)); } catch (error) { outcomes.released = classify(error); }
	}
	var queued = call(target);
	var stopping = unbound.plugins.stop(host.id);
	outcomes.stopped = await settle(queued);
	await stopping;
	await unbound.plugins.start(host.id);
	return JSON.stringify({ host: host.data.name, cancellations: outcomes });
})()`;
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
