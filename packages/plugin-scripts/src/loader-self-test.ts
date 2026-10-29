export const SELF_TEST_MARKER = 'loader self-test';

export type SelfTestResult = { ok: boolean; detail: string };

export type SelfTestCounts = {
	host?: string;
	platform?: string;
	base?: number;
	derived?: number;
	error?: string;
};

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

	const chain = counts.platform === 'ios' ? `, subclass ${counts.derived}` : '';

	return {
		ok: true,
		detail: `hooks fired (base ${counts.base}${chain}) and the error named ${counts.host}`,
	};
}
