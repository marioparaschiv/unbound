import { metro, startPlugin } from '@unbound-app/api/testing';
import { expect, test } from 'bun:test';
import { memo } from 'react';
import { Text } from 'react-native';

const folder = 'modules/chat_input/native/action_buttons/';

const GiftOrThreadButton = memo(({ hideGiftButton }: { hideGiftButton?: boolean }) => (
	<Text>{hideGiftButton ? 'thread only' : 'gift and thread'}</Text>
));

test('a part that cannot be patched fails the start', async () => {
	metro.register(
		{ default: GiftOrThreadButton },
		`${folder}ChatInputActionButtonGiftOrThread.tsx`,
	);
	metro.register({ default: 'not a component' }, `${folder}ChatInputRightActions.tsx`);

	await expect(startPlugin()).rejects.toThrow('Failed to patch component');
});
