import { metro, native, render, startPlugin, stopPlugin, toasts } from '@unbound-app/api/testing';
import { beforeEach, expect, test } from 'bun:test';
import { Pressable, View } from 'react-native';

import { OVERLAY_BUTTON_PATH, OVERLAY_HEADER_PATH } from '~/constants';

const VIDEO = { videoURI: 'https://cdn.discordapp.com/attachments/1/2/clip.mp4' };

function OverlayButton(props: { accessibilityLabel?: string; onPress?: () => void }) {
	return <Pressable {...props} />;
}

const header = {
	MediaModalOverlayHeader(_props: { source?: unknown }) {
		return (
			<View>
				<OverlayButton accessibilityLabel='close' />
				<OverlayButton accessibilityLabel='download' />
			</View>
		);
	},
};

beforeEach(() => {
	metro.register({ default: OverlayButton }, OVERLAY_BUTTON_PATH);
	metro.register(header, OVERLAY_HEADER_PATH);
});

// A window the viewer never finishes opening: Discord's view search does not settle, so the session stays starting.
async function startWithPendingWindow() {
	native.objc.registerClass('AVPlayerLayer');
	native.objc.registerClass('UIWindow');
	native.objc.registerClass('UIApplication', {
		classMethods: { sharedApplication: () => native.objc.create('UIApplication') },
		methods: { keyWindow: () => native.objc.create('UIWindow') },
	});
	const objc = { findViews: () => new Promise(() => undefined) };

	await startPlugin({ native: { objc: objc as never } });
}

const labels = (view: ReturnType<typeof render>) =>
	view.findAll('Pressable').map((node) => node.props.accessibilityLabel);

test('a press opens a session, and stopping the plugin ends it and takes the button away', async () => {
	await startWithPendingWindow();

	const view = render(<header.MediaModalOverlayHeader source={VIDEO} />);

	expect(labels(view)).toContain('Picture in Picture');

	view.act(() =>
		view
			.find((node) => node.props.accessibilityLabel === 'Picture in Picture')
			.props.onPress?.(),
	);

	expect(labels(view)).toContain('Close Picture in Picture');

	await stopPlugin();

	expect(labels(view)).not.toContain('Close Picture in Picture');
	expect(labels(view)).not.toContain('Picture in Picture');
	expect(toasts.shown).toEqual([]);
});
