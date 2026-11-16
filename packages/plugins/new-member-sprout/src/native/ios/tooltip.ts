import type { NativeObjectHandle, PluginContext } from '@unbound-app/api/native';
import { createIOSTooltips } from '@unbound-plugins/shared/tooltips/ios-tooltips';
import { safeInvokeAsync } from '@unbound-plugins/shared/native/ios/safe-invoke';

import type { SproutTooltip, TouchPoint } from '~/native/tooltip';
import { anchorAround } from '~/native/tooltip-anchor';

/**
 * @description Creates the iOS tooltip, opened over the key window.
 * @param context The plugin context, whose Objective-C and Fabric bridges draw it.
 * @returns The tooltip.
 */
export function createTooltip(context: PluginContext): SproutTooltip {
	const { objc } = context.native;
	const tooltips = createIOSTooltips(context.native, 'NewMemberSproutTooltipSurface');

	async function keyWindow() {
		const UIApplication = objc.getClass('UIApplication');
		const application = UIApplication
			? ((await safeInvokeAsync(
					objc,
					UIApplication,
					'sharedApplication',
				)) as NativeObjectHandle | null)
			: null;

		return application
			? ((await safeInvokeAsync(objc, application, 'keyWindow')) as NativeObjectHandle | null)
			: null;
	}

	return {
		show: (point: TouchPoint | undefined, text: string) => {
			if (!point) return;

			tooltips.show({
				key: 'sprout',
				text,
				window: keyWindow,
				frame: async () => anchorAround(point),
			});
		},
		dispose: () => tooltips.dispose(),
	};
}

export default { createTooltip };
