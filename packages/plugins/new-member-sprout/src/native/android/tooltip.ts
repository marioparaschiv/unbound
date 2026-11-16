import type { PluginContext } from '@unbound-app/api/native';
import { createAndroidTooltips } from '@unbound-plugins/shared/tooltips/android-tooltips';
import { javaNumber, javaReference } from '@unbound-plugins/shared/native/android/java-values';
import { currentDecorView } from '@unbound-plugins/shared/native/android/views';

import type { SproutTooltip } from '~/native/tooltip';
import { anchorAround } from '~/native/tooltip-anchor';

/**
 * @description Creates the Android tooltip, opened over the window where the window last saw a touch begin.
 * @param context The plugin context, whose Java, hook and Fabric bridges draw it.
 * @returns The tooltip.
 */
export function createTooltip(context: PluginContext): SproutTooltip {
	const { java } = context.native;
	const tooltips = createAndroidTooltips(context.native, 'NewMemberSproutTooltipSurface');

	function lastTouch(density: number) {
		const decor = currentDecorView(java);
		const root = decor ? javaReference(java.invoke(decor, 'getViewRootImpl', [])) : null;
		const point = root ? javaReference(java.getField(root, 'mLastTouchPoint')) : null;
		const x = point ? javaNumber(java.getField(point, 'x')) : undefined;
		const y = point ? javaNumber(java.getField(point, 'y')) : undefined;

		return x === undefined || y === undefined
			? null
			: anchorAround({ x: x / density, y: y / density });
	}

	return {
		show: (_point, text) =>
			tooltips.show({
				key: 'sprout',
				text,
				frame: (density) => {
					try {
						return lastTouch(density);
					} catch (error) {
						logger.error(
							'Failed to read the last touch for the sprout tooltip:',
							error,
						);

						return null;
					}
				},
			}),
		dispose: () => tooltips.dispose(),
	};
}

export default { createTooltip };
