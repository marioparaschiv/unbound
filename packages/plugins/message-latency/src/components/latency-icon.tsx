import registerAppSurface from '@unbound-plugins/shared/native/app-surface';
import { Pressable, View } from 'react-native';
import { useSyncExternalStore } from 'react';

import type { LatencyRecord } from '~/records';
import { FILL_TOKENS, Icon } from '~/constants';
import { resolveColor } from '~/theme';

export type IconSource = {
	record(surfaceId: string): LatencyRecord | undefined;
	revision(surfaceId: string): number;
	subscribe(surfaceId: string, listener: () => void): () => void;
	press(surfaceId: string): void;
};

type LatencyIconProps = {
	surfaceId: string;
};

/**
 * @description Registers the root component Fabric surfaces mount to draw the three-bar indicator, as a tappable control the size of the iOS one.
 * @param source Looks up each surface's record, tells the surface when it changes, and receives its taps.
 * @returns The registered module name to mount, or `undefined` when React Native refused it.
 */
export function registerLatencyIconSurface(source: IconSource): string | undefined {
	function LatencyIconSurface({ surfaceId }: LatencyIconProps) {
		useSyncExternalStore(
			(listener) => source.subscribe(surfaceId, listener),
			() => source.revision(surfaceId),
		);

		const record = source.record(surfaceId);
		const size = { width: Icon.controlWidth, height: Icon.controlHeight };

		if (!record) return <View style={size} />;

		return (
			<Pressable
				accessibilityRole='button'
				accessibilityLabel={record.details.displayDelta ?? 'Old Discord Android client'}
				accessibilityHint={record.tooltip}
				onPress={() => source.press(surfaceId)}
				style={size}
			>
				{Icon.bars.map((bar, index) => (
					<View
						key={index}
						style={{
							position: 'absolute',
							left: bar.x,
							top: bar.y,
							width: bar.width,
							height: bar.height,
							borderRadius: 0.5,
							backgroundColor: resolveColor(FILL_TOKENS[record.details.fill[index]!]),
						}}
					/>
				))}
			</Pressable>
		);
	}

	return registerAppSurface('MessageLatencyIconSurface', LatencyIconSurface);
}

export default { registerLatencyIconSurface };
