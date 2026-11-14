import { settings } from '@unbound-app/settings';
import { logs, metro, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

type Message = { content: string; set(key: 'content', value: string): Message };

const message = (content: string): Message => ({
	content,
	set: (_key, value) => message(value),
});

const MessageRowData = {
	generateMessageRowData: (input: { message: Message }) => ({
		message: { content: input.message.content },
	}),
};

function rowContent(content: string) {
	return MessageRowData.generateMessageRowData({
		message: message(content),
	}).message.content.replaceAll('\u00a0', ' ');
}

beforeEach(() => {
	metro.register(MessageRowData);
});

describe('unit conversions in chat', () => {
	beforeEach(async () => {
		settings.system = 'metric';
		await startPlugin();
	});

	test('draws a conversion after each measurement', () => {
		expect(rowContent('I ran 3 miles')).toBe('I ran 3 miles (≈ 4.83 km)');
	});

	test('leaves messages without measurements alone', () => {
		expect(rowContent('hello there')).toBe('hello there');
	});

	test('starts without a warning, so its self-test passes', () => {
		expect(logs.entries.filter(({ level }) => level === 'warn' || level === 'error')).toEqual(
			[],
		);
	});
});
