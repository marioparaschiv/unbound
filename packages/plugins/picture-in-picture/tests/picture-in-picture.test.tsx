import { render } from '@unbound-app/api/testing';
import { describe, expect, test } from 'bun:test';
import { Pressable } from 'react-native';

import { PipButton } from '~/picture-in-picture/button/components/pip-button';
import { createController } from '~/picture-in-picture/session/controller';
import { createSessionStore } from '~/picture-in-picture/session/store';
import type { PipWindow } from '~/types';

const VIDEO = { videoURI: 'https://cdn.discordapp.com/attachments/1/2/clip.mp4' };

const window: PipWindow = {
	enter: () => Promise.resolve('active'),
	exit: () => 'ended',
	dispose: () => {},
};

function OverlayButton(props: { accessibilityLabel?: string; onPress?: () => void }) {
	return <Pressable {...props} />;
}

function renderButton(source: unknown) {
	const sessions = createSessionStore<string>();
	const controller = createController(sessions, window, {
		onFailed: () => {},
		giveUpAfterMs: 50,
	});

	return render(
		<PipButton
			source={source as never}
			Button={OverlayButton}
			sessions={sessions}
			controller={controller}
		/>,
	);
}

describe('the header button', () => {
	test('is labelled for opening picture in picture on a video', () => {
		const label = renderButton(VIDEO).find('Pressable').props.accessibilityLabel;

		expect(label).toBe('Picture in Picture');
	});

	test('offers to close once the video is in the window', async () => {
		const view = renderButton(VIDEO);

		view.act(() => view.find('Pressable').props.onPress?.(Object.create(null)));
		await Promise.resolve();
		await Promise.resolve();

		expect(view.find('Pressable').props.accessibilityLabel).toBe('Close Picture in Picture');
	});

	test('is hidden for an image', () => {
		expect(
			renderButton({ uri: 'https://cdn.discordapp.com/a.png' }).findAll('Pressable'),
		).toEqual([]);
	});
});
