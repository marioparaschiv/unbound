import type { TextReplaceRule } from '@unbound-plugins/shared/text-replace/rules';
import { Discord } from '@unbound-app/api/metro/components';
import { format, messages } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';
import { View } from 'react-native';

import { ruleKindMessages } from '~/components/rule-kind-messages';
import type { RuleKind } from '~/constants';

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
		? format('ONLY_WHEN_INCLUDES', { text: rule.onlyIfIncludes })
		: messages.APPLIES_TO_EVERY_MESSAGE;

	return (
		<View>
			<Discord.Text variant='text-xs/medium' color='text-muted' lineClamp={1}>
				→ {rule.replace || messages.REMOVE_IT}
			</Discord.Text>
			<Discord.Text variant='text-xs/medium' color='text-muted' lineClamp={1}>
				{tag}
				{condition}
			</Discord.Text>
		</View>
	);
}

function RuleList({ kind, rules, onAdd, onEdit }: RuleListProps) {
	const { title, description, tag, addRule } = ruleKindMessages(kind);

	return (
		<ui.Section
			title={format('RULES_SECTION_TITLE', { title: title, count: rules.length })}
			description={description}
		>
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
				<ui.Row label={messages.NO_RULES_YET} subLabel={messages.NO_RULES_SUBTITLE} />
			)}
			<ui.Row label={addRule} onPress={onAdd} />
		</ui.Section>
	);
}

export default RuleList;
