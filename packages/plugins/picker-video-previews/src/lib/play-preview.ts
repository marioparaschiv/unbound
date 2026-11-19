import type { ComponentType } from 'react';

import {
	findElement,
	isElementNode,
	type ElementNode,
} from '@unbound-plugins/shared/react/find-element';

type Source = { uri?: unknown };

type MediaProps = {
	children?: unknown;
	paused?: unknown;
	source?: Source;
	style?: unknown;
	preventsDisplaySleepDuringVideoPlayback?: unknown;
};

export type PreviewUpload = { isVideo?: boolean; item?: { uri?: string } };

// UNKNOWN: Discord's video component takes react-native-video's props.
export type VideoComponent = ComponentType<Record<string, unknown>>;

/** Builds the player that replaces a media picker thumbnail. */
export type PlayerFactory = (thumbnail: ElementNode, uri: string) => ElementNode;

const MAX_DEPTH = 15;

function propsOf(element: ElementNode): MediaProps | undefined {
	return element.props as MediaProps | undefined;
}

function isPausedVideo(element: ElementNode): boolean {
	const props = propsOf(element);

	return Boolean(
		props && props.paused === true && 'preventsDisplaySleepDuringVideoPlayback' in props,
	);
}

function playback(sound: boolean) {
	return {
		paused: false,
		repeat: true,
		muted: !sound,
		preventsDisplaySleepDuringVideoPlayback: false,
	};
}

function replaceThumbnail(
	// UNKNOWN: a component may render any node.
	node: unknown,
	uri: string,
	toPlayer: PlayerFactory,
	depth = 0,
): boolean {
	if (depth > MAX_DEPTH || !isElementNode(node)) return false;

	const children = Array.isArray(node) ? node : propsOf(node)?.children;

	if (!Array.isArray(children)) {
		return isElementNode(children) && replaceThumbnail(children, uri, toPlayer, depth + 1);
	}

	for (const [index, child] of children.entries()) {
		const props = isElementNode(child) ? propsOf(child) : undefined;

		if (props?.source?.uri === uri && !('children' in props)) {
			children[index] = toPlayer(child as ElementNode, uri);

			return true;
		}

		if (replaceThumbnail(child, uri, toPlayer, depth + 1)) return true;
	}

	return false;
}

/**
 * @description Plays the video in Discord's upload preview sheet on a loop: starts its paused player, or swaps the
 * still thumbnail it shows for media picker items for a player.
 * @param result The sheet's render result.
 * @param upload The upload the sheet previews.
 * @param sound Whether the video plays with sound.
 * @param toPlayer Builds the player for a thumbnail.
 * @returns Whether a video now plays.
 */
export function playPreview(
	// UNKNOWN: a component may render any node.
	result: unknown,
	upload: PreviewUpload | undefined,
	sound: boolean,
	toPlayer: PlayerFactory,
): boolean {
	const player = findElement(result, isPausedVideo);

	if (player?.props) {
		Object.assign(player.props, playback(sound));

		return true;
	}

	const uri = upload?.item?.uri;

	if (!upload?.isVideo || !uri) return false;

	return replaceThumbnail(result, uri, toPlayer);
}

export default playPreview;
