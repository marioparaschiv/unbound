import { definePlatform, type PluginContext } from '@unbound-app/api/native';

import { createTagGradients as android } from '~/native/views-android';
import { createTagGradients as ios } from '~/native/views-ios';
import { labelAppearances } from '~/lib/label-appearances';
import type { TagGradients } from '~/lib/types';
import { tagProblems } from '~/lib/tag-problems';

const createTagGradients = definePlatform({ ios, android });

let gradients: TagGradients | undefined;
let stopGradients: (() => void) | undefined;

/**
 * @description Draws each tag's role-color gradient natively behind Discord's message tags.
 * @param context The native plugin context the gradient renderer draws with.
 */
export function drawTagGradients(context: PluginContext): void {
	gradients = createTagGradients(context, labelAppearances);
	stopGradients = gradients.start();
}

/**
 * @description Removes the native gradients, which the Addon scope does not see.
 * @returns A promise that settles once every gradient layer is gone.
 */
export async function eraseTagGradients(): Promise<void> {
	const current = gradients;

	stopGradients?.();
	stopGradients = undefined;
	gradients = undefined;
	await current?.settled();
}

/**
 * @description Reports tags that look wrong, and whether the gradients on screen look right.
 * @returns Whether the plugin looks healthy, with a detail line.
 */
export async function selfTestTags() {
	const problems = [...tagProblems(), ...((await gradients?.problems()) ?? [])];

	if (problems.length) {
		return {
			ok: false,
			detail: `${problems.length} tags look wrong: ${problems.slice(0, 3).join('; ')}`,
		};
	}

	const drawn = gradients?.drawn() ?? 0;

	return {
		ok: true,
		detail: drawn ? `tags applied, ${drawn} tag gradients look right` : 'tags applied',
	};
}
