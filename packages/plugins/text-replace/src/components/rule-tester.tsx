import { applyRules } from '@unbound-plugins/shared/text-replace/rules';
import { Discord } from '@unbound-app/api/metro/components';
import { ui } from '@unbound-app/api';
import { useState } from 'react';

import type { Ruleset } from '~/ruleset';

type RuleTesterProps = {
	ruleset: Ruleset;
};

function RuleTester({ ruleset }: RuleTesterProps) {
	const [shown, setShown] = useState(true);
	const [example, setExample] = useState('');

	return (
		<Discord.Stack spacing={12}>
			<ui.Section title='Try your rules'>
				<ui.Row
					label='Test your rules'
					trailing={<Discord.TableRow.TrailingText text={shown ? '⌃' : '⌄'} />}
					onPress={() => setShown((value) => !value)}
				/>
			</ui.Section>
			{shown ? (
				<>
					<Discord.TextInput
						label='Example message'
						placeholder='Type a message to test'
						autoCapitalize='none'
						autoCorrect={false}
						multiline
						value={example}
						onChange={setExample}
					/>
					<ui.Section title='Result'>
						<ui.Row
							label={
								applyRules(example, ruleset.stringRules, ruleset.regexRules) ||
								'Your transformed message will appear here.'
							}
						/>
					</ui.Section>
				</>
			) : null}
		</Discord.Stack>
	);
}

export default RuleTester;
