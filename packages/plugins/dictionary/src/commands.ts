import { commands } from '@unbound-app/api';

import { openDefinition, openVocabulary } from '~/lib/sheets';

/**
 * @description Adds `/define`, which looks a word up, and `/vocabulary`, which lists the saved words.
 */
export function registerCommands(): void {
	commands.register({
		define: {
			description: 'DEFINE_DESC',
			options: { word: commands.option.string({ description: 'WORD_DESC', required: true }) },
			execute: ({ word }) => {
				openDefinition(word.trim());
			},
		},
		vocabulary: {
			description: 'VOCABULARY_DESC',
			execute: () => {
				openVocabulary();
			},
		},
	});
}

export default { registerCommands };
