import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import findVisibleCells from '@unbound-plugins/shared/native/ios/visible-cells';
import type { PluginContext } from '@unbound-app/api/native';
import { AccessibilityInfo } from 'react-native';

import {
	inspectTagGradients,
	installTagGradients,
	removeTagGradients,
	setTagSettings,
	type TagSettings,
} from '~/ios/ui-tag-gradients';
import type { LabelAppearances } from '~/label-appearances';
import type { TagGradients } from '~/tag-gradients';

const PUSH_DELAY_MS = 0;
const TAG_VIEW_CLASS = 'DiscordChat.MessageTagView';

/**
 * @description Paints role gradients behind Discord's native user tags from UI-thread hooks, fed with the label appearances the JS patches collect.
 * @param context The plugin context.
 * @param appearances The gradient each label and color should get.
 * @returns The gradient lifecycle and its self-test probes.
 */
export function createTagGradients(
	context: PluginContext,
	appearances: LabelAppearances,
): TagGradients {
	let drawn = 0;
	let problems: () => Promise<string[]> = () => Promise.resolve([]);

	function start(): () => void {
		if (
			!ensureCapabilities('More User Tags: gradients', context.native, context.capabilities)
		) {
			return () => {};
		}

		const { objc, ui } = context.native;
		const scope = ui.createScope();
		let reduceMotion = false;
		let timer: ReturnType<typeof setTimeout> | undefined;

		const settings = (): TagSettings => ({
			appearances: appearances.snapshot(),
			reduceMotion,
		});

		async function relayoutVisibleTags() {
			const views = await findVisibleCells(objc, TAG_VIEW_CLASS);

			await Promise.all(views.map((view) => objc.invokeAsync(view, 'setNeedsLayout', [])));
		}

		function push() {
			timer = undefined;
			ui.run(setTagSettings, settings());
			relayoutVisibleTags().catch(() => undefined);
		}

		function schedulePush() {
			timer ??= setTimeout(push, PUSH_DELAY_MS);
		}

		ui.call(installTagGradients, scope, settings())
			.then((installed) => {
				if (!installed) {
					console.error('[More User Tags: gradients] Skipped, native classes not found.');
				}
			})
			.catch((error) => {
				console.error('[More User Tags: gradients] Failed to install the hooks:', error);
			});

		const unsubscribe = appearances.subscribe(schedulePush);

		void AccessibilityInfo.isReduceMotionEnabled()
			.then((enabled) => {
				reduceMotion = enabled;
				schedulePush();
			})
			.catch(() => undefined);

		problems = async () => {
			const counts = await ui.call(inspectTagGradients);

			drawn = counts.painted;

			return counts.problems;
		};

		return () => {
			unsubscribe();
			clearTimeout(timer);
			problems = () => Promise.resolve([]);
			drawn = 0;
			ui.run(removeTagGradients);
			scope.dispose();
			appearances.clear();
		};
	}

	return {
		start,
		settled: () => Promise.resolve(),
		problems: () => problems(),
		drawn: () => drawn,
	};
}

export default { createTagGradients };
