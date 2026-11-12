import type { PluginContext } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';

import type { FileSizes } from '~/lib/types';
import { createFileSizes as android } from '~/native/android/calls';
import { createFileSizes as ios } from '~/native/ios/calls';

const createFileSizes = native.definePlatform({ ios, android });

let opened: FileSizes | undefined;

/**
 * @description Opens the platform's file size lookup, which holds native handles until {@link releaseFileSizes}.
 * @param context The plugin's context, whose Java bridge Android reads the sizes Discord leaves out with.
 * @returns The lookup, or none on a platform whose picker already reports sizes.
 */
export function openFileSizes(context: PluginContext): FileSizes {
	opened = createFileSizes(context);

	return opened;
}

/**
 * @description Releases the native handles the size lookup holds, which the plugin scope cannot see.
 */
export function releaseFileSizes(): void {
	opened?.release();
	opened = undefined;
}
