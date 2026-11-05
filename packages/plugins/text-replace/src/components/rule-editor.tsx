import type { TextReplaceRule } from '@unbound-plugins/shared/text-replace/rules';
import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';
import { useState } from 'react';

import { ruleKindMessages } from '~/components/rule-kind-messages';
import type { RuleKind } from '~/constants';
import { deleteRule, saveRule } from '~/replace/stored-rules';

type RuleEditorProps = {
	kind: RuleKind;
	rule: TextReplaceRule;
	isNew: boolean;
	onClose: () => void;
};

type RuleField = 'find' | 'replace' | 'onlyIfIncludes';

function RuleEditor({ kind, rule, isNew, onClose }: RuleEditorProps) {
	const [draft, setDraft] = useState(rule);
	const { findLabel, findPlaceholder, help, newRule } = ruleKindMessages(kind);

	function update(field: RuleField, value: string) {
		setDraft((current) => ({ ...current, [field]: value }));
	}

	function save() {
		saveRule(kind, draft, isNew);
		onClose();
	}

	function remove() {
		deleteRule(kind, rule.id);
		onClose();
	}

	return (
		<ui.Page>
			<Discord.Stack spacing={8} align='start'>
				<Discord.Button
					text={messages.BACK_TO_RULES}
					variant='tertiary'
					size='sm'
					onPress={onClose}
				/>
				<Discord.Text variant='heading-xl/bold'>
					{isNew ? newRule : messages.EDIT_RULE}
				</Discord.Text>
				<Discord.Text variant='text-md/normal' color='text-muted'>
					{help}
				</Discord.Text>
			</Discord.Stack>
			<Discord.TextInput
				label={findLabel}
				placeholder={findPlaceholder}
				autoCapitalize='none'
				autoCorrect={false}
				value={draft.find}
				onChange={(value) => update('find', value)}
			/>
			<Discord.TextInput
				label={messages.REPLACE_WITH}
				placeholder={messages.REPLACE_PLACEHOLDER}
				autoCapitalize='none'
				autoCorrect={false}
				multiline
				value={draft.replace}
				onChange={(value) => update('replace', value)}
			/>
			<Discord.TextInput
				label={messages.ONLY_WHEN_CONTAINS}
				placeholder={messages.CONDITION_PLACEHOLDER}
				description={messages.CONDITION_DESCRIPTION}
				autoCapitalize='none'
				autoCorrect={false}
				value={draft.onlyIfIncludes}
				onChange={(value) => update('onlyIfIncludes', value)}
			/>
			<Discord.Stack spacing={12}>
				<Discord.Button
					text={messages.SAVE_RULE}
					disabled={!draft.find.trim()}
					onPress={save}
				/>
				{isNew ? null : (
					<Discord.Button
						text={messages.DELETE_RULE}
						variant='destructive'
						onPress={remove}
					/>
				)}
			</Discord.Stack>
		</ui.Page>
	);
}

export default RuleEditor;
