import type { SelfTestResult } from '@unbound-plugins/shared/lifecycle/features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { applyRules } from '@unbound-plugins/shared/text-replace/rules';
import { patcher } from '@unbound-app/api';

import { normalizeStoredRules, readRules } from '~/replace/stored-rules';
import { RULES_CHANNEL_ID } from '~/constants';
import { Messages } from '~/replace/modules';

type Message = { content: string };
type MessageArgument = Partial<Message> | string | null | undefined;

function isMessage(argument: MessageArgument): argument is Message {
	return typeof argument === 'object' && typeof argument?.content === 'string';
}

/**
 * @description Rewrites each outgoing message with the stored rules before Discord sends it.
 * Patches `sendMessage` of Discord's message actions (`metro.api.Messages`). The Addon scope removes the patch when the plugin stops.
 */
export function startReplace(): void {
	normalizeStoredRules();

	if (!ensureModules({ Messages })) return;

	patcher.before(Messages, 'sendMessage', ({ args }) => {
		if (args[0] === RULES_CHANNEL_ID) return;

		const message = (args as MessageArgument[]).find(isMessage);

		if (!message?.content) return;

		message.content = applyRules(
			message.content,
			readRules('stringRules'),
			readRules('regexRules'),
		);
	});
}

const SAMPLE_RULE = { id: 'self-test', find: 'teh', replace: 'the', onlyIfIncludes: '' };

/**
 * @description Checks that outgoing messages are being rewritten, with a sample rule.
 * @param features The features' own result, which says whether the patch is installed.
 * @returns Whether the patch is installed and the sample rule gave the expected text, with a detail line.
 */
export function replaceSelfTest(features: SelfTestResult): SelfTestResult {
	const replaced = applyRules('teh cat', [SAMPLE_RULE], []);

	return {
		ok: features.ok && replaced === 'the cat',
		detail: `${features.ok ? 'patched sendMessage' : features.detail}, sample rule gave "${replaced}"`,
	};
}
