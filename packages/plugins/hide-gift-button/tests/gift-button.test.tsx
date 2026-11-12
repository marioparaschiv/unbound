import { logs, metro, render, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';
import { memo, type ReactNode } from 'react';
import { Text, View } from 'react-native';

type ButtonProps = { hideGiftButton?: boolean };
type ActionsProps = { shouldShowGiftButton?: boolean };

function TransitionItem(_props: { renderItem: () => ReactNode }) {
	return <Text>gift slot</Text>;
}

function Expression() {
	return <Text>expressions</Text>;
}

const GiftOrThreadButton = memo(({ hideGiftButton }: ButtonProps) => (
	<Text>{hideGiftButton ? 'thread only' : 'gift and thread'}</Text>
));

const ChatInputRightActions = memo(({ shouldShowGiftButton }: ActionsProps) => (
	<View>
		{shouldShowGiftButton ? <TransitionItem renderItem={() => null} /> : null}
		<Expression />
	</View>
));

const folder = 'modules/chat_input/native/action_buttons/';

beforeEach(async () => {
	metro.register(
		{ default: GiftOrThreadButton },
		`${folder}ChatInputActionButtonGiftOrThread.tsx`,
	);
	metro.register({ default: ChatInputRightActions }, `${folder}ChatInputRightActions.tsx`);

	await startPlugin();
});

describe('the composer actions', () => {
	test('hides the gift from the gift-or-thread button', () => {
		expect(render(<GiftOrThreadButton hideGiftButton={false} />).text()).toBe('thread only');
	});

	test('hides a button that has no gift option to turn off', () => {
		expect(render(<GiftOrThreadButton />).text()).toBe('');
	});

	test('drops the gift slot and keeps the other actions', () => {
		expect(render(<ChatInputRightActions shouldShowGiftButton />).text()).toBe('expressions');
	});

	test('leaves the actions alone when no gift shows', () => {
		expect(render(<ChatInputRightActions />).text()).toBe('expressions');
	});
});

describe('health', () => {
	test('starts without a warning', () => {
		expect(logs.entries.filter(({ level }) => level === 'warn' || level === 'error')).toEqual(
			[],
		);
	});

	test('skips the gift slot with one warning when Discord moved ChatInputRightActions', async () => {
		await stopPlugin();
		metro.markMissing(`${folder}ChatInputRightActions.tsx`);
		await startPlugin();

		expect(render(<GiftOrThreadButton hideGiftButton={false} />).text()).toBe('thread only');
		expect(logs.entries).toContainEqual({
			level: 'warn',
			args: ['Gift slot skipped: Discord moved ChatInputRightActions.'],
		});
	});
});
