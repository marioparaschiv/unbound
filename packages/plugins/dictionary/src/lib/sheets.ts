import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';

import VocabularySheet from '~/components/vocabulary-sheet';
import DefinitionSheet from '~/components/definition-sheet';
import WordsSheet from '~/components/words-sheet';

/**
 * @description Opens a word's definition.
 * @param word The word.
 */
export function openDefinition(word: string): void {
	openSheet('unbound-dictionary-definition', DefinitionSheet, { word });
}

/**
 * @description Opens the list of a message's words.
 * @param words The words.
 */
export function openWords(words: string[]): void {
	openSheet('unbound-dictionary-words', WordsSheet, { words });
}

/**
 * @description Opens the saved words.
 */
export function openVocabulary(): void {
	openSheet('unbound-dictionary-vocabulary', VocabularySheet, {});
}

export default { openDefinition, openWords, openVocabulary };
