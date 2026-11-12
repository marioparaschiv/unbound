import type { Plugin, PluginSelfTestResult } from '@unbound-app/types';

type Testable = {
	readonly started: boolean;
	readonly instance: Plugin | null;
	readonly startIssues: readonly string[];
};

// UNKNOWN: a bundle's self-test may return any value at runtime, whatever its types say.
function toReport(value: unknown): PluginSelfTestResult | undefined {
	if (typeof value !== 'object' || value === null) return;

	const detail = String('detail' in value ? value.detail : undefined);
	const drawing = 'nothingDrawn' in value && value.nothingDrawn ? { nothingDrawn: true } : {};

	if (!('ok' in value && value.ok)) {
		return { ok: false, detail, ...drawing };
	}

	return {
		ok: true,
		detail,
		...drawing,
		...('settling' in value && value.settling ? { settling: true } : {}),
	};
}

/**
 * @description Reads a running plugin's self-test for first-party device tooling: a warning or error it logged while starting fails it,
 * else its own `selfTest` export decides, else it passes.
 * @param addon The plugin, if installed.
 * @returns The report, or `undefined` when the plugin is not running or its self-test reported nothing; rejects with what the self-test threw.
 */
export async function readSelfTest(
	addon: Testable | undefined,
): Promise<PluginSelfTestResult | undefined> {
	if (!addon?.started) return;

	const [issue] = addon.startIssues;

	if (issue !== undefined) {
		return { ok: false, detail: issue };
	}

	if (typeof addon.instance?.selfTest !== 'function') {
		return { ok: true, detail: 'started without warnings' };
	}

	return toReport(await addon.instance.selfTest());
}
