import { metro, render, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { EMBED_ERROR_PATH, YOUTUBE_PATH } from '~/constants';

const VIDEO_ID = 'dQw4w9WgXcQ';

function WebView(_props: { source: { html: string; baseUrl: string } }) {
	return null;
}

const embedError = {
	default: (_props: { videoId: unknown }) => <Text>This video can’t be played here</Text>,
};

const viewer = {
	default: (props: { visible?: boolean; onToggleOverlay?: () => void; children: ReactNode }) => (
		<>{props.children}</>
	),
};

beforeEach(async () => {
	metro.register({ WebView });
	metro.register(embedError, EMBED_ERROR_PATH);
	metro.register(viewer, YOUTUBE_PATH);
	await startPlugin();
});

describe('a blocked YouTube video in the media viewer', () => {
	test('plays in YouTube’s own embed instead of the error', () => {
		const view = render(<embedError.default videoId={`https://youtu.be/${VIDEO_ID}`} />);

		expect(view.findAll('Text')).toEqual([]);
		expect(view.find('WebView').props.source).toMatchObject({
			baseUrl: 'https://www.youtube-nocookie.com/',
		});
		expect(view.find('WebView').props.source.html).toContain(VIDEO_ID);
	});

	test('keeps Discord’s error when the video id is not a YouTube video', () => {
		const view = render(<embedError.default videoId='not a video' />);

		expect(view.text()).toBe('This video can’t be played here');
	});

	test('a tap on the player toggles the viewer’s controls', () => {
		let toggles = 0;
		const view = render(
			<viewer.default visible onToggleOverlay={() => void (toggles += 1)}>
				<embedError.default videoId={VIDEO_ID} />
			</viewer.default>,
		);
		const touch = (timestamp: number) => ({
			nativeEvent: { pageX: 10, pageY: 10, timestamp, touches: [{}] },
		});
		const player = view.find((node) => typeof node.props.onTouchStart === 'function');

		view.act(() => player.props.onTouchStart?.(touch(1000) as never));
		view.act(() => player.props.onTouchEnd?.(touch(1100) as never));

		expect(toggles).toBe(1);
	});
});
