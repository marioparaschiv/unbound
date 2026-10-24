import { applyRules, normalizeRules } from '@unbound-plugins/shared/text-replace/rules';

import { Plugins, textReplaceSettings } from '~/modules';

/**
 * @description Rewrites a draft the way Text Replace will rewrite it on send.
 * @param content The draft.
 * @returns The draft with the user's Text Replace rules applied, or unchanged when that plugin is not running.
 */
export function applyTextReplace(content: string): string {
	if (!Plugins.getEntity('unbound.text-replace')?.started) return content;

	return applyRules(
		content,
		normalizeRules(textReplaceSettings.get('stringRules', [])),
		normalizeRules(textReplaceSettings.get('regexRules', [])),
	);
}

export default applyTextReplace;
