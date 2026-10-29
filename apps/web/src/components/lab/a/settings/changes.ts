import type { EditAddonRequest } from '@unbound-app/contracts/admin';

/** The settings a staff edit can change, in the order the page shows them. */
export type EditableKey = Exclude<keyof EditAddonRequest, 'revision' | 'reason'>;

export const EDITABLE_LABELS: Record<EditableKey, string> = {
	name: 'Name',
	type: 'Type',
	description: 'Description',
	repository: 'Repository',
	delisted: 'Visibility',
	maintainers: 'Maintainers',
};

const EDITABLE_KEYS = Object.keys(EDITABLE_LABELS) as EditableKey[];

/**
 * @description Lists the settings whose value differs from the saved one.
 * @param values The form's current values.
 * @param saved The values the form started from.
 * @returns The changed settings, in page order.
 */
export function changedKeys(values: EditAddonRequest, saved: EditAddonRequest): EditableKey[] {
	return EDITABLE_KEYS.filter(
		(key) => JSON.stringify(values[key]) !== JSON.stringify(saved[key]),
	);
}

export default { EDITABLE_LABELS, changedKeys };
