import type { NativeBridge } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';

import { createViewer as android } from '~/native/android/viewer';
import { createViewer as ios } from '~/native/ios/viewer';

export type PdfViewer = {
	open(path: string): Promise<void>;
	dispose(): void;
};

const createPlatformViewer = native.definePlatform({ ios, android });

/**
 * @description Creates this platform's PDF viewer.
 * @param bridge The plugin's native bridge.
 * @returns The viewer, or `undefined` on a platform without one.
 */
export function createPdfViewer(bridge: NativeBridge): PdfViewer | undefined {
	return createPlatformViewer(bridge) ?? undefined;
}

export default { createPdfViewer };
