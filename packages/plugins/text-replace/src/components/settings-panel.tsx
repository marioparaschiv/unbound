import { createRule, type TextReplaceRule } from '@unbound-plugins/shared/text-replace/rules';
import Page from '@unbound-plugins/shared/components/page';
import { Discord } from '@unbound-app/api/metro/components';
import { useState } from 'react';

import RulesetTransfer from '~/components/ruleset-transfer';
import type { RuleKind } from '~/constants';
import RuleEditor from '~/components/rule-editor';
import RuleTester from '~/components/rule-tester';
import { readRuleset } from '~/stored-rules';
import RuleList from '~/components/rule-list';
import { settings } from '~/modules';

type Editing = {
	kind: RuleKind;
	rule: TextReplaceRule;
	isNew: boolean;
};

function SettingsPanel() {
	const store = settings.useSettingsStore();
	const [kind, setKind] = useState<RuleKind>('stringRules');
	const [editing, setEditing] = useState<Editing | null>(null);
	const ruleset = readRuleset(store);

	if (editing) {
		return <RuleEditor {...editing} onClose={() => setEditing(null)} />;
	}

	return (
		<Page>
			<Discord.Stack spacing={8}>
				<Discord.Text variant='heading-xl/bold'>Text Replace</Discord.Text>
				<Discord.Text variant='text-md/normal' color='text-muted'>
					Automatically rewrite messages before you send them.
				</Discord.Text>
			</Discord.Stack>
			<RuleTester ruleset={ruleset} />
			<RulesetTransfer ruleset={ruleset} />
			<Discord.TableRadioGroup title='Rule type' value={kind} onChange={setKind}>
				<Discord.TableRadioRow label='Text' value='stringRules' />
				<Discord.TableRadioRow label='Regex' value='regexRules' />
			</Discord.TableRadioGroup>
			<RuleList
				kind={kind}
				rules={ruleset[kind]}
				onAdd={() => setEditing({ kind, rule: createRule(), isNew: true })}
				onEdit={(rule) => setEditing({ kind, rule, isNew: false })}
			/>
		</Page>
	);
}

export default SettingsPanel;
