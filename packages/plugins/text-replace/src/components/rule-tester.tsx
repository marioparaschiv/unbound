import { applyRules } from '@unbound-plugins/shared/text-replace/rules';
import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';
import { useState } from 'react';

import type { Ruleset } from '@unbound-plugins/shared/text-replace/stored-rules';

type RuleTesterProps = {
	ruleset: Ruleset;
};

function RuleTester({ ruleset }: RuleTesterProps) {
	const [shown, setShown] = useState(true);
	const [example, setExample] = useState('');

	return (
		<Discord.Stack spacing={12}>
			<ui.Section title={messages.TRY_YOUR_RULES}>
				<ui.Row
					label={messages.TEST_YOUR_RULES}
					trailing={<Discord.TableRow.TrailingText text={shown ? '⌃' : '⌄'} />}
					onPress={() => setShown((value) => !value)}
				/>
			</ui.Section>
			{shown ? (
				<>
					<Discord.TextInput
						label={messages.EXAMPLE_MESSAGE}
						placeholder={messages.EXAMPLE_PLACEHOLDER}
						autoCapitalize='none'
						autoCorrect={false}
						multiline
						value={example}
						onChange={setExample}
					/>
					<ui.Section title={messages.RESULT}>
						<ui.Row
							label={
								applyRules(example, ruleset.stringRules, ruleset.regexRules) ||
								messages.RESULT_PLACEHOLDER
							}
						/>
					</ui.Section>
				</>
			) : null}
		</Discord.Stack>
	);
}

export default RuleTester;
