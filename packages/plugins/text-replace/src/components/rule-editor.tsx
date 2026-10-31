import type { TextReplaceRule } from '@unbound-plugins/shared/text-replace/rules';
import Page from '@unbound-plugins/shared/components/page';
import { Discord } from '@unbound-app/api/metro/components';
import { useState } from 'react';

import { RuleKinds, type RuleKind } from '~/constants';
import { deleteRule, saveRule } from '~/stored-rules';

type RuleEditorProps = {
	kind: RuleKind;
	rule: TextReplaceRule;
	isNew: boolean;
	onClose: () => void;
};

type RuleField = 'find' | 'replace' | 'onlyIfIncludes';

function RuleEditor({ kind, rule, isNew, onClose }: RuleEditorProps) {
	const [draft, setDraft] = useState(rule);
	const { noun, findLabel, findPlaceholder, help } = RuleKinds[kind];

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
		<Page>
			<Discord.Stack spacing={8} align='start'>
				<Discord.Button
					text='‹ Back to rules'
					variant='tertiary'
					size='sm'
					onPress={onClose}
				/>
				<Discord.Text variant='heading-xl/bold'>
					{isNew ? `New ${noun} rule` : 'Edit rule'}
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
				label='Replace with'
				placeholder='What should it become? Use \\n for a new line.'
				autoCapitalize='none'
				autoCorrect={false}
				multiline
				value={draft.replace}
				onChange={(value) => update('replace', value)}
			/>
			<Discord.TextInput
				label='Only when the message contains'
				placeholder='Optional condition'
				description='Leave this blank to apply the rule everywhere.'
				autoCapitalize='none'
				autoCorrect={false}
				value={draft.onlyIfIncludes}
				onChange={(value) => update('onlyIfIncludes', value)}
			/>
			<Discord.Stack spacing={12}>
				<Discord.Button text='Save rule' disabled={!draft.find.trim()} onPress={save} />
				{isNew ? null : (
					<Discord.Button text='Delete rule' variant='destructive' onPress={remove} />
				)}
			</Discord.Stack>
		</Page>
	);
}

export default RuleEditor;
