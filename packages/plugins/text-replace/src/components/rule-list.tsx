import type { TextReplaceRule } from '@unbound-plugins/shared/text-replace/rules';
import { Discord } from '@unbound-app/api/metro/components';
import { ui } from '@unbound-app/api';
import { View } from 'react-native';

import { RuleKinds, type RuleKind } from '~/constants';

type RuleListProps = {
	kind: RuleKind;
	rules: TextReplaceRule[];
	onAdd: () => void;
	onEdit: (rule: TextReplaceRule) => void;
};

type RuleSummaryProps = {
	rule: TextReplaceRule;
	tag: string;
};

function RuleSummary({ rule, tag }: RuleSummaryProps) {
	const condition = rule.onlyIfIncludes
		? `Only when it includes “${rule.onlyIfIncludes}”`
		: 'Applies to every message';

	return (
		<View>
			<Discord.Text variant='text-xs/medium' color='text-muted' lineClamp={1}>
				→ {rule.replace || 'Remove it'}
			</Discord.Text>
			<Discord.Text variant='text-xs/medium' color='text-muted' lineClamp={1}>
				{tag}
				{condition}
			</Discord.Text>
		</View>
	);
}

function RuleList({ kind, rules, onAdd, onEdit }: RuleListProps) {
	const { noun, title, description, tag } = RuleKinds[kind];

	return (
		<ui.Section title={`${title} · ${rules.length}`} description={description}>
			{rules.length ? (
				rules.map((rule) => (
					<ui.Row
						key={rule.id}
						label={rule.find}
						subLabel={<RuleSummary rule={rule} tag={tag} />}
						labelLineClamp={1}
						arrow
						onPress={() => onEdit(rule)}
					/>
				))
			) : (
				<ui.Row label='No rules yet' subLabel='Add one when you are ready.' />
			)}
			<ui.Row label={`Add ${noun} rule`} onPress={onAdd} />
		</ui.Section>
	);
}

export default RuleList;
