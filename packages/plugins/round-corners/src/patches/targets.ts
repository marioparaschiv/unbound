import { findRenderTarget } from '@unbound-plugins/shared/react/render-target';
import type { AnyProps } from '@unbound-app/api/metro';
import { settings } from '@unbound-app/settings';
import { metro, patcher } from '@unbound-app/api';

import { roundTree } from '~/lib/rounder';
import { targets, type Target } from '~/lib/targets';

const waiting = new Set<() => void>();

function hookComponent(target: Target, module: AnyProps, exportName: string) {
	const render = findRenderTarget(module, exportName);

	if (!render) return;

	patcher.after(render.holder, render.key, ({ args: [props], result }) =>
		settings[target.setting] ? roundTree(result, target.rule, { owner: props }) : result,
	);
}

/**
 * @description Re-rounds each target's components as they render, and overrides the corner tokens no render shows, each behind its setting.
 * Components that load later are hooked when they load.
 */
export function patchTargets(): void {
	for (const target of targets(() => settings.selectedShape)) {
		target.tokens?.(() => settings[target.setting]);

		for (const component of target.components) {
			waiting.add(
				metro.onModuleLoaded(
					metro.filters.byFilePath(component.path),
					(module: AnyProps) =>
						hookComponent(target, module, component.export ?? 'default'),
					{ interop: false },
				),
			);
		}
	}
}

/**
 * @description Stops waiting for components that have not loaded, so none is hooked after the plugin stops.
 */
export function stopWaiting(): void {
	for (const stop of waiting) stop();

	waiting.clear();
}
