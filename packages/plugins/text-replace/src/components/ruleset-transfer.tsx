import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { toasts, ui } from '@unbound-app/api';
import { useState } from 'react';

import { readClipboard, shareRuleset } from '~/replace/transfer';
import type { Ruleset } from '@unbound-plugins/shared/text-replace/stored-rules';

import { parseRuleset } from '~/replace/ruleset';
import { saveRuleset } from '~/replace/stored-rules';

type RulesetTransferProps = {
	ruleset: Ruleset;
};

function importRuleset(value: string): boolean {
	try {
		saveRuleset(parseRuleset(value));
		toasts.success('RULESET_IMPORTED');

		return true;
	} catch (error) {
		toasts.error('IMPORT_FAILED', error);

		return false;
	}
}

function RulesetTransfer({ ruleset }: RulesetTransferProps) {
	const [pasted, setPasted] = useState('');

	function importValue(value: string) {
		if (importRuleset(value)) {
			setPasted('');
		}
	}

	async function importClipboard() {
		const value = await readClipboard();

		if (!value.trim()) {
			toasts.warning('CLIPBOARD_HAS_NO_RULESET');

			return;
		}

		importValue(value);
	}

	return (
		<Discord.Stack spacing={12}>
			<ui.Section title={messages.SHARE_RULES} description={messages.SHARE_RULES_DESCRIPTION}>
				<ui.Row
					label={messages.EXPORT_AND_SHARE}
					onPress={() => void shareRuleset(ruleset)}
				/>
				<ui.Row label={messages.IMPORT_CLIPBOARD} onPress={() => void importClipboard()} />
			</ui.Section>
			<Discord.TextInput
				label={messages.PASTE_JSON}
				placeholder={messages.PASTE_JSON_PLACEHOLDER}
				autoCapitalize='none'
				autoCorrect={false}
				multiline
				value={pasted}
				onChange={setPasted}
			/>
			<Discord.Button
				text={messages.IMPORT_PASTED}
				variant='secondary'
				disabled={!pasted.trim()}
				onPress={() => importValue(pasted)}
			/>
		</Discord.Stack>
	);
}

export default RulesetTransfer;
