import { describe, expect, test } from 'bun:test';

import { typingLabel, type TypingLabelValues } from './typing-label';

function unavailable() {
	return undefined;
}

describe('typingLabel', () => {
	test('names up to three typing users in English when Discord has no string', () => {
		expect(typingLabel([], unavailable)).toBe('');
		expect(typingLabel(['Alice'], unavailable)).toBe('Alice is typing...');
		expect(typingLabel(['Alice', 'Bob'], unavailable)).toBe('Alice and Bob are typing...');
		expect(typingLabel(['Alice', 'Bob', 'Casey'], unavailable)).toBe(
			'Alice, Bob, and Casey are typing...',
		);
		expect(typingLabel(['Alice', 'Bob', 'Casey', 'Drew'], unavailable)).toBe(
			'Several people are typing...',
		);
	});

	test("uses Discord's localized string for the number of typing users", () => {
		const german: Record<string, string> = {
			lJ9sZX: '{a} schreibt...',
			uVDhqZ: 'Mehrere Personen schreiben...',
		};

		function format(messageId: string, values: TypingLabelValues) {
			return german[messageId]?.replace('{a}', values.a ?? '');
		}

		expect(typingLabel(['Alice'], format)).toBe('Alice schreibt...');
		expect(typingLabel(['Alice', 'Bob'], format)).toBe('Alice and Bob are typing...');
		expect(typingLabel(['Alice', 'Bob', 'Casey', 'Drew', 'Eve'], format)).toBe(
			'Mehrere Personen schreiben...',
		);
	});
});
