import { messages } from '@unbound-app/i18n';
import { toasts, ui } from '@unbound-app/api';

import { readClipboard, shareRuleset } from '~/lib/transfer';
import type { Ruleset } from '@unbound-plugins/shared/text-replace/stored-rules';

import { parseRuleset } from '~/lib/ruleset';
import { saveRuleset } from '~/lib/stored-rules';

type RulesetTransferProps = {
	ruleset: Ruleset;
};

function importRuleset(value: string): void {
	try {
		saveRuleset(parseRuleset(value));
		toasts.success('RULESET_IMPORTED');
	} catch (error) {
		toasts.error('IMPORT_FAILED', error);
	}
}

function RulesetTransfer({ ruleset }: RulesetTransferProps) {
	async function importClipboard() {
		const value = await readClipboard();

		if (!value.trim()) {
			toasts.warning('CLIPBOARD_HAS_NO_RULESET');

			return;
		}

		importRuleset(value);
	}

	return (
		<ui.Section title={messages.SHARE_RULES} description={messages.SHARE_RULES_DESCRIPTION}>
			<ui.Row label={messages.EXPORT_AND_SHARE} onPress={() => void shareRuleset(ruleset)} />
			<ui.Row label={messages.IMPORT_CLIPBOARD} onPress={() => void importClipboard()} />
		</ui.Section>
	);
}

export default RulesetTransfer;
