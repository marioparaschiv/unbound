import { findRenderTarget } from '@unbound-plugins/shared/react/render-target';
import { metro, patcher } from '@unbound-app/api';
import { useRef, useSyncExternalStore, type ComponentType, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { PipClip, PipClipStore } from '~/lib/pip-clip';
import { OVERLAY_PATH, VIDEO_PROTOTYPE } from '~/lib/constants';

const EXTERNAL_PIP_VIEW_PATH = 'modules/external_pip/ExternalPipView.android.tsx';

type VideoHandle = { seek?: (seconds: number) => void };

type VideoProps = {
	ref?: (handle: VideoHandle | null) => void;
	source: { uri: string };
	style: unknown;
	resizeMode: 'contain';
	paused: boolean;
	playInBackground: boolean;
	playWhenInactive: boolean;
	onLoad: () => void;
	onProgress: (event: { currentTime?: unknown }) => void;
};

const styles = StyleSheet.create({
	surface: {
		position: 'absolute',
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		backgroundColor: '#000',
	},
});

function videoComponent(): ComponentType<VideoProps> | undefined {
	const module = metro.find(metro.filters.byPrototypes(...VIDEO_PROTOTYPE), {
		interop: false,
	}) as { default?: unknown } | ((...args: never[]) => unknown) | undefined;
	const candidate = typeof module === 'function' ? module : module?.default;

	return typeof candidate === 'function' ? (candidate as ComponentType<VideoProps>) : undefined;
}

type VideoClip = Extract<PipClip, { kind: 'video' }>;

function ClipPlayer({ clip, store }: { clip: VideoClip; store: PipClipStore }) {
	const handle = useRef<VideoHandle | null>(null);
	const Video = videoComponent();

	if (!Video) return null;

	return (
		<View style={styles.surface}>
			<Video
				ref={(next) => {
					handle.current = next;
				}}
				source={{ uri: clip.uri }}
				style={StyleSheet.absoluteFill}
				resizeMode='contain'
				paused={false}
				playInBackground
				playWhenInactive
				onLoad={() => handle.current?.seek?.(clip.startAt)}
				onProgress={({ currentTime }) => {
					if (typeof currentTime === 'number') store.recordTime(currentTime);
				}}
			/>
		</View>
	);
}

function HiddenInPip({ store, overlay }: { store: PipClipStore; overlay: ReactNode }) {
	const clip = useSyncExternalStore(store.subscribe, store.current);

	return clip ? null : overlay;
}

function PipSurface({ store, fallback }: { store: PipClipStore; fallback: ReactNode }) {
	const clip = useSyncExternalStore(store.subscribe, store.current);

	if (!clip) return fallback;

	return clip.kind === 'video' ? <ClipPlayer key={clip.uri} clip={clip} store={store} /> : null;
}

function patchRender(path: string, name: string, render: (result: ReactNode) => ReactNode): void {
	metro.onModuleLoaded(
		metro.filters.byFilePath(path),
		(module) => {
			const target = findRenderTarget(module);

			if (!target) {
				logger.warn(`Picture in picture surface skipped: ${name} has no render function.`);

				return;
			}

			patcher.after(target.holder, target.key, ({ result }) => render(result as ReactNode));
		},
		{
			onMissing: () =>
				logger.warn(`Picture in picture surface skipped: Discord moved ${name}.`),
		},
	);
}

/**
 * @description Shows the clip in Discord's own Android picture in picture surface, `ExternalPipView`, which covers the window, and hides the media viewer's controls while the window is open.
 * A web player's clip clears the surface, so the window shows the viewer's own page playing. Without a clip both render unchanged.
 * @param store The clip the window plays.
 */
export function patchPipSurface(store: PipClipStore): void {
	patchRender(EXTERNAL_PIP_VIEW_PATH, 'ExternalPipView', (result) => (
		<PipSurface store={store} fallback={result} />
	));
	patchRender(OVERLAY_PATH, 'MediaModalOverlay', (result) => (
		<HiddenInPip store={store} overlay={result} />
	));
}
