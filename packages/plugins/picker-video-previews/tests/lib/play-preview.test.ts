import { describe, expect, test } from 'bun:test';

import { playPreview, type PlayerFactory } from '~/lib/play-preview';

const toPlayer: PlayerFactory = (thumbnail, uri) => ({
	type: 'Player',
	props: { children: [uri, thumbnail] },
});

function sheet(media: Record<string, unknown>) {
	return {
		type: 'View',
		props: {
			children: [
				{ type: 'Text', props: { children: 'a.mp4' } },
				{
					type: 'View',
					props: {
						children: [
							{ type: 'Image', props: media },
							{ type: 'Caption', props: { label: '0:10' } },
						],
					},
				},
			],
		},
	};
}

function mediaOf(tree: ReturnType<typeof sheet>) {
	return (
		tree.props.children[1] as {
			props: { children: { type: unknown; props: Record<string, unknown> }[] };
		}
	).props.children[0];
}

describe('playPreview', () => {
	test('starts and loops a paused player, muted by default', () => {
		const video = {
			source: { uri: 'file:///a.mp4' },
			muted: true,
			paused: true,
			preventsDisplaySleepDuringVideoPlayback: false,
		};

		expect(
			playPreview(
				sheet(video),
				{ isVideo: true, item: { uri: 'file:///a.mp4' } },
				false,
				toPlayer,
			),
		).toBe(true);
		expect(video).toMatchObject({ paused: false, repeat: true, muted: true });
	});

	test('swaps a picker thumbnail for a player', () => {
		const tree = sheet({ style: { width: 1 }, source: { uri: 'ph://A' } });

		const thumbnail = mediaOf(tree);

		expect(playPreview(tree, { isVideo: true, item: { uri: 'ph://A' } }, true, toPlayer)).toBe(
			true,
		);
		expect(mediaOf(tree)).toEqual({
			type: 'Player',
			props: { children: ['ph://A', thumbnail] },
		});
	});

	test('leaves images alone', () => {
		const tree = sheet({ source: { uri: 'ph://B' } });

		expect(
			playPreview(tree, { isVideo: false, item: { uri: 'ph://B' } }, false, toPlayer),
		).toBe(false);
		expect(mediaOf(tree).type).toBe('Image');
	});
});
