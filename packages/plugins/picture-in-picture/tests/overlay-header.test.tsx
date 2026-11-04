import { metro, render, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { OVERLAY_BUTTON_PATH, OVERLAY_HEADER_PATH } from '~/constants';

type ButtonProps = { accessibilityLabel?: string; onPress?: () => void };

const VIDEO = { videoURI: 'https://cdn.discordapp.com/attachments/1/2/clip.mp4' };

function OverlayButton(props: ButtonProps) {
	return <Pressable {...props} />;
}

const buttonModule = { default: OverlayButton };

function button(label: string) {
	return <OverlayButton key={label} accessibilityLabel={label} />;
}

// Discord's header: a close button on the left, the share and download buttons on the right.
function Header(rows: ReactNode) {
	return function MediaModalOverlayHeader(_: { source?: unknown }) {
		return <View>{rows}</View>;
	};
}

function labels(view: ReturnType<typeof render>) {
	return view.findAll('Pressable').map((node) => node.props.accessibilityLabel);
}

async function start(rows: ReactNode) {
	const header = { MediaModalOverlayHeader: Header(rows) };

	metro.register(buttonModule, OVERLAY_BUTTON_PATH);
	metro.register(header, OVERLAY_HEADER_PATH);
	await startPlugin();

	return header;
}

afterEach(stopPlugin);

describe('the media viewer header', () => {
	const rows = [
		<View key='left'>{button('close')}</View>,
		<Text key='title'>clip.mp4</Text>,
		<View key='right'>
			{button('share')}
			{button('download')}
		</View>,
	];

	test('gets a picture in picture button before the last button of the last row', async () => {
		const { MediaModalOverlayHeader } = await start(rows);

		expect(labels(render(<MediaModalOverlayHeader source={VIDEO} />))).toEqual([
			'close',
			'share',
			'Picture in Picture',
			'download',
		]);
	});

	test('has no button for an image', async () => {
		const { MediaModalOverlayHeader } = await start(rows);
		const view = render(
			<MediaModalOverlayHeader source={{ uri: 'https://cdn.discordapp.com/a.png' }} />,
		);

		expect(labels(view)).toEqual(['close', 'share', 'download']);
	});

	test('wraps a header holding one button into a row', async () => {
		const { MediaModalOverlayHeader } = await start(button('share'));

		expect(labels(render(<MediaModalOverlayHeader source={VIDEO} />))).toEqual([
			'Picture in Picture',
			'share',
		]);
	});

	test('keeps the header as Discord drew it when it holds no button', async () => {
		const { MediaModalOverlayHeader } = await start(<Text>clip.mp4</Text>);
		const view = render(<MediaModalOverlayHeader source={VIDEO} />);

		expect(labels(view)).toEqual([]);
		expect(view.text()).toBe('clip.mp4');
	});
});
