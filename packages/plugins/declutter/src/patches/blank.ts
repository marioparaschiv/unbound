import { findRenderTarget } from '@unbound-plugins/shared/react/render-target';
import type { AnyProps } from '@unbound-app/api/metro';
import { settings } from '@unbound-app/settings';
import { patcher } from '@unbound-app/api';

import { BLANK_TARGETS, type BlankTarget } from '~/lib/blank-targets';
import { whenLoaded } from '~/lib/when-loaded';

function blank(target: BlankTarget, module: AnyProps, method: string) {
	const enabled = () => Boolean(settings[target.setting]);

	if (!target.component) {
		if (typeof module[method] !== 'function') return;

		patcher.after(module, method, ({ result }) => (enabled() ? target.value : result));

		return;
	}

	const render = findRenderTarget(module, method);

	if (!render) return;

	patcher.after(render.holder, render.key, ({ result }) => (enabled() ? null : result));
}

/**
 * @description Blanks what each decluttered Discord module returns, such as avatar decorations, nameplates and server tags,
 * while its setting is on. Hooks still run, so Discord's hook order never changes; modules that load later are patched then.
 */
export function patchBlankTargets(): void {
	for (const target of BLANK_TARGETS) {
		whenLoaded(target.module, (module) => {
			for (const method of target.methods) blank(target, module, method);
		});
	}
}

export default patchBlankTargets;
