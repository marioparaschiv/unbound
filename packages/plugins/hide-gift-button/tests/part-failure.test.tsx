import { metro, render, startPlugin } from '@unbound-app/api/testing';
import { expect, test } from 'bun:test';
import { memo } from 'react';
import { Text } from 'react-native';

import { selfTest } from '~/index';

const folder = 'modules/chat_input/native/action_buttons/';

const GiftOrThreadButton = memo(({ hideGiftButton }: { hideGiftButton?: boolean }) => (
	<Text>{hideGiftButton ? 'thread only' : 'gift and thread'}</Text>
));

test('a part that cannot be patched leaves the other hiding the gift and fails the self test', async () => {
	metro.register(
		{ default: GiftOrThreadButton },
		`${folder}ChatInputActionButtonGiftOrThread.tsx`,
	);
	metro.register({ default: 'not a component' }, `${folder}ChatInputRightActions.tsx`);

	await startPlugin();

	expect(render(<GiftOrThreadButton hideGiftButton={false} />).text()).toBe('thread only');
	expect(selfTest().ok).toBe(false);
});
