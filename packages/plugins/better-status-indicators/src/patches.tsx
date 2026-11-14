import { findRenderTarget } from '@unbound-plugins/shared/react/render-target';
import type { AnyProps } from '@unbound-app/api/metro';
import { settings } from '@unbound-app/settings';
import { metro, patcher } from '@unbound-app/api';
import { View } from 'react-native';
import type { ReactNode } from 'react';

import { ringColor } from '~/lib/status-color';

type AvatarProps = { status?: string } & AnyProps;

// The avatar's own view can be wider than its picture, which sits at its left; a square as tall as the view fits the picture.
function Ringed({ color, children }: { color: string; children: ReactNode }) {
	const width = settings.thickness;

	return (
		<View style={{ alignSelf: 'flex-start' }}>
			{children}
			<View
				pointerEvents='none'
				style={{
					position: 'absolute',
					top: -width,
					left: -width,
					bottom: -width,
					aspectRatio: 1,
					borderRadius: 9999,
					borderWidth: width,
					borderColor: color,
				}}
			/>
		</View>
	);
}

/**
 * @description Rings avatars in their status colour and, unless kept, drops Discord's status dot, by patching the
 * render of Discord's `Avatar`.
 */
export function patchAvatar(): void {
	const module = metro.findByFilePath('design/void/Avatar/native/Avatar.tsx', { interop: false });
	const render = module ? findRenderTarget(module) : null;

	if (!render) {
		logger.warn('Status rings skipped: Discord moved Avatar.');

		return;
	}

	patcher.instead(render.holder, render.key, ({ args, original, this: self }) => {
		const [props, ...rest] = args as [AvatarProps | undefined, ...unknown[]];
		const color = ringColor(props?.status, settings.offline);

		if (!props || !color) return original.apply(self, args);

		const avatar = original.apply(self, [
			settings.keepDot ? props : { ...props, status: undefined },
			...rest,
		]);

		return <Ringed color={color}>{avatar}</Ringed>;
	});
}

export default patchAvatar;
