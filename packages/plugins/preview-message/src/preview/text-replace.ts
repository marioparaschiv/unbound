import { rules, TEXT_REPLACE_ID } from '@unbound-plugins/shared/text-replace/stored-rules';
import { applyRules } from '@unbound-plugins/shared/text-replace/rules';

import { plugins } from '@unbound-app/api';

/**
 * @description Rewrites a draft the way Text Replace will rewrite it on send.
 * @param content The draft.
 * @returns The draft with the user's Text Replace rules applied, or unchanged when that plugin is not running.
 */
export function applyTextReplace(content: string): string {
	if (!plugins.get(TEXT_REPLACE_ID)?.started) return content;

	const { stringRules, regexRules } = rules();

	return applyRules(content, stringRules, regexRules);
}

export default applyTextReplace;
