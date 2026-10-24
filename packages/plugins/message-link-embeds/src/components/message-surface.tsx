import registerAppSurface from '@unbound-plugins/shared/native/app-surface';
import { View, type LayoutChangeEvent } from 'react-native';

import { EmbeddedMediaContext } from '~/components/embedded-media';
import { reportSurfaceLayout } from '~/native/surfaces';
import type { Session } from '~/native/session';
import { Surface } from '~/constants';

type MessageSurfaceProps = {
	surfaceId: string;
	renderRevision: number;
};

/**
 * @description Registers the root component that Fabric surfaces mount to render embeds.
 * @param session The running session.
 * @returns The registered module name to mount, or `undefined` when React Native refused it.
 */
export function registerMessageSurface(session: Session): string | undefined {
	function MessageSurface({ renderRevision, surfaceId }: MessageSurfaceProps) {
		const surface = session.surfacesById.get(surfaceId);
		const { ChatItem } = session.renderers;

		if (!surface) return <View style={{ height: 1 }} />;

		function onLayout(event: LayoutChangeEvent) {
			reportSurfaceLayout(session, surfaceId, event.nativeEvent.layout.height);
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
					<ChatItem
						key={surfaceId}
						message={surface.record}
						renderRevision={renderRevision}
						rowGenerator={surface.generator}
					/>
				</View>
			</EmbeddedMediaContext.Provider>
		);
	}

	return registerAppSurface('MessageLinkEmbedSurface', MessageSurface);
}
