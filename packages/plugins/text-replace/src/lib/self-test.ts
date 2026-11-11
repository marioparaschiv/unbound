import type { PluginSelfTestResult } from '@unbound-app/api/global';
import { applyRules } from '@unbound-plugins/shared/text-replace/rules';

const SAMPLE_RULE = { id: 'self-test', find: 'teh', replace: 'the', onlyIfIncludes: '' };

/**
 * @description Checks that the rules rewrite text, with a sample rule. Unbound runs it only when starting logged no warning.
 * @returns Whether the sample rule gave the expected text, with a detail line.
 */
export function selfTest(): PluginSelfTestResult {
	const replaced = applyRules('teh cat', [SAMPLE_RULE], []);

	return {
		ok: replaced === 'the cat',
		detail: `patched sendMessage, sample rule gave "${replaced}"`,
	};
}
