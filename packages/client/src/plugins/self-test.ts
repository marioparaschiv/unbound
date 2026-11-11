import type { Plugin, PluginSelfTestResult } from '@unbound-app/types';

type Testable = { readonly started: boolean; readonly instance: Plugin | null };

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
 * @description Runs a running plugin's self-test and reads its report into the {@link PluginSelfTestResult} shape, for first-party device tooling.
 * @param addon The plugin, if installed.
 * @returns The report, or `undefined` when the plugin is not running, has no self-test or reported nothing; rejects with what the self-test threw.
 */
export async function readSelfTest(
	addon: Testable | undefined,
): Promise<PluginSelfTestResult | undefined> {
	const instance = addon?.started ? addon.instance : null;

	if (typeof instance?.selfTest !== 'function') return;

	return toReport(await instance.selfTest());
}
