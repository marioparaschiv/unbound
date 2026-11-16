import { describe, expect, test } from 'bun:test';

import { readFreeDictionary, readWiktionary } from '~/lib/definitions';
import { wordsIn } from '~/lib/words';

describe('wordsIn', () => {
	test('lists each word once, without links, mentions, emoji or code', () => {
		expect(
			wordsIn('Hello <@123> hello! see https://x.com `code` :smile: café NASA don’t a'),
		).toEqual(['hello', 'see', 'café', 'NASA', "don't"]);
	});
});

describe('readFreeDictionary', () => {
	test('merges homographs and keeps the phonetic and audio', () => {
		const entry = readFreeDictionary('bank', [
			{
				word: 'bank',
				phonetic: '/bæŋk/',
				phonetics: [{ text: '/bæŋk/', audio: 'https://a/bank.mp3' }],
				meanings: [
					{
						partOfSpeech: 'noun',
						definitions: [{ definition: 'A river edge.', example: 'On the bank.' }],
					},
				],
			},
			{
				word: 'bank',
				meanings: [{ partOfSpeech: 'verb', definitions: [{ definition: 'To tilt.' }] }],
			},
		]);

		expect(entry).toEqual({
			word: 'bank',
			phonetic: '/bæŋk/',
			audio: 'https://a/bank.mp3',
			meanings: [
				{
					partOfSpeech: 'noun',
					senses: [{ definition: 'A river edge.', example: 'On the bank.' }],
				},
				{ partOfSpeech: 'verb', senses: [{ definition: 'To tilt.' }] },
			],
			source: 'Free Dictionary API',
		});
	});

	test('reads an unknown word as nothing', () => {
		expect(readFreeDictionary('zzz', { title: 'No Definitions Found' })).toBeUndefined();
	});
});

describe('readWiktionary', () => {
	test('prefers the reader language and strips markup', () => {
		const entry = readWiktionary(
			'Haus',
			{
				en: [{ partOfSpeech: 'Noun', definitions: [{ definition: 'English sense' }] }],
				de: [
					{
						partOfSpeech: 'Noun',
						definitions: [
							{
								definition: '<a href="x">house</a>, &amp; home',
								examples: ['<i>Das Haus</i>'],
							},
						],
					},
				],
			},
			'de',
		);

		expect(entry?.meanings).toEqual([
			{
				partOfSpeech: 'Noun',
				senses: [{ definition: 'house, & home', example: 'Das Haus' }],
			},
		]);
	});
});
