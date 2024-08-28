import { createLogger } from '@structures/logger';

import * as Patches from './registry';

const Logger = createLogger('Core', 'Patches');

export async function apply() {
	for (const id in Patches) {
		const Patch = Patches[id];

		try {
			await Patch.apply?.();
		} catch (e) {
			Logger.error(`Failed to apply ${id} patch:`, e.message);
		}
	}
}

export async function remove() {
	for (const id in Patches) {
		const Patch = Patches[id];

		try {
			await Patch.remove?.();
		} catch (e) {
			Logger.error(`Failed to remove ${id} patch:`, e.message);
		}
	}
}

export default { apply, remove };