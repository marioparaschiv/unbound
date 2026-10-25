import registerAppSurface from '@unbound-plugins/shared/native/app-surface';
import { View, type LayoutChangeEvent } from 'react-native';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { EmbeddedMediaContext } from '~/components/embedded-media';
import type { Message, Renderers, RowGenerator } from '~/modules';
import { CollapsedRemount, Surface } from '~/constants';

export type SurfaceContent = {
	record: Message;
	generator: RowGenerator;
	width: number;
};

export type SurfaceSource = {
	renderers: Pick<Renderers, 'ChatItem'>;
	surface(surfaceId: string): SurfaceContent | undefined;
	reportLayout(surfaceId: string, height: number): void;
	revision?(surfaceId: string): number;
	subscribe?(surfaceId: string, listener: () => void): () => void;
};

function staticSubscription() {
	return () => {};
}

type MessageSurfaceProps = {
	surfaceId: string;
	renderRevision: number;
};

/**
 * @description Registers the root component that Fabric surfaces mount to render embeds.
 * @param source Looks up each surface's content, receives the height it lays out at, and can tell a surface when its content changes.
 * @returns The registered module name to mount, or `undefined` when React Native refused it.
 */
export function registerMessageSurface(source: SurfaceSource): string | undefined {
	function MessageSurface({ renderRevision, surfaceId }: MessageSurfaceProps) {
		const contentRevision = useSyncExternalStore(
			(listener) => (source.subscribe ?? staticSubscription)(surfaceId, listener),
			() => source.revision?.(surfaceId) ?? 0,
		);
		const surface = source.surface(surfaceId);
		const { ChatItem } = source.renderers;
		const [mountAttempt, setMountAttempt] = useState(0);
		const remount = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

		useEffect(() => () => clearTimeout(remount.current), []);

		if (!surface) return <View style={{ height: 1 }} />;

		function onItemLayout(event: LayoutChangeEvent) {
			const collapsed = event.nativeEvent.layout.height < CollapsedRemount.minHeight;

			clearTimeout(remount.current);

			if (!collapsed || mountAttempt >= CollapsedRemount.limit) return;

			remount.current = setTimeout(
				() => setMountAttempt((attempt) => attempt + 1),
				CollapsedRemount.delay,
			);
		}

		function onLayout(event: LayoutChangeEvent) {
			source.reportLayout(surfaceId, event.nativeEvent.layout.height);
		}

		return (
			<EmbeddedMediaContext.Provider value>
				<View
					onLayout={onLayout}
					style={{
						backgroundColor: Surface.background,
						borderRadius: 8,
						overflow: 'hidden',
						minHeight: Surface.minHeight,
						paddingBottom: 0,
						paddingTop: 6,
						width: surface.width,
					}}
				>
					<View onLayout={onItemLayout}>
						<ChatItem
							key={`${surfaceId}-${mountAttempt}`}
							message={surface.record}
							renderRevision={renderRevision + contentRevision}
							rowGenerator={surface.generator}
						/>
					</View>
				</View>
			</EmbeddedMediaContext.Provider>
		);
	}

	return registerAppSurface('MessageLinkEmbedSurface', MessageSurface);
}
