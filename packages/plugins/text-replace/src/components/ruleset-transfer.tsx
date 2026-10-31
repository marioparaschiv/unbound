import { Discord } from '@unbound-app/api/metro/components';
import { toasts, ui } from '@unbound-app/api';
import { useState } from 'react';

import { readClipboard, shareRuleset } from '~/transfer';
import { parseRuleset, type Ruleset } from '~/ruleset';
import { saveRuleset } from '~/stored-rules';

type RulesetTransferProps = {
	ruleset: Ruleset;
};

function importRuleset(value: string): boolean {
	try {
		saveRuleset(parseRuleset(value));
		toasts.show({ title: 'Text Replace', content: 'Ruleset imported.' });

		return true;
	} catch (error) {
		toasts.show({
			title: 'Text Replace',
			content: error instanceof Error ? error.message : 'Could not import ruleset.',
		});

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
			toasts.show({
				title: 'Text Replace',
				content: 'Your clipboard does not contain a ruleset.',
			});

			return;
		}

		importValue(value);
	}

	return (
		<Discord.Stack spacing={12}>
			<ui.Section
				title='Share rules'
				description='Export or import both rule lists as portable JSON.'
			>
				<ui.Row label='Export & share' onPress={() => void shareRuleset(ruleset)} />
				<ui.Row label='Import clipboard' onPress={() => void importClipboard()} />
			</ui.Section>
			<Discord.TextInput
				label='Paste JSON'
				placeholder='Paste exported Text Replace JSON here'
				autoCapitalize='none'
				autoCorrect={false}
				multiline
				value={pasted}
				onChange={setPasted}
			/>
			<Discord.Button
				text='Import pasted'
				variant='secondary'
				disabled={!pasted.trim()}
				onPress={() => importValue(pasted)}
			/>
		</Discord.Stack>
	);
}

export default RulesetTransfer;
