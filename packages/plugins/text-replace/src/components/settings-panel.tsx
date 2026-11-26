import { rules, type RuleKind } from '@unbound-plugins/shared/text-replace/stored-rules';
import { createRule, type TextReplaceRule } from '@unbound-plugins/shared/text-replace/rules';
import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { storage, ui } from '@unbound-app/api';
import { useState } from 'react';

import RulesetTransfer from '~/components/ruleset-transfer';
import RuleEditor from '~/components/rule-editor';
import RuleTester from '~/components/rule-tester';
import RuleList from '~/components/rule-list';

type Editing = {
	kind: RuleKind;
	rule: TextReplaceRule;
	isNew: boolean;
};

function SettingsPanel() {
	const store = storage.useBucket(addon.id);
	const [kind, setKind] = useState<RuleKind>('stringRules');
	const [editing, setEditing] = useState<Editing | null>(null);
	const ruleset = rules(store);

	if (editing) {
		return <RuleEditor {...editing} onClose={() => setEditing(null)} />;
	}

	return (
		<ui.Page>
			<Discord.TableRadioGroup title={messages.RULE_TYPE} value={kind} onChange={setKind}>
				<Discord.TableRadioRow label={messages.RULE_TYPE_TEXT} value='stringRules' />
				<Discord.TableRadioRow label={messages.RULE_TYPE_REGEX} value='regexRules' />
			</Discord.TableRadioGroup>
			<RuleList
				kind={kind}
				rules={ruleset[kind]}
				onAdd={() => setEditing({ kind, rule: createRule(), isNew: true })}
				onEdit={(rule) => setEditing({ kind, rule, isNew: false })}
			/>
			<RuleTester ruleset={ruleset} />
			<RulesetTransfer ruleset={ruleset} />
		</ui.Page>
	);
}

export default SettingsPanel;
