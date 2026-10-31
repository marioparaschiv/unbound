import type { FieldChange } from '@unbound-app/contracts/admin';

/**
 * @description Words one field of a staff edit for the moderation log.
 * @param change The field's change.
 * @returns The phrase that follows "edited", e.g. `name to "Greeter"`.
 */
function describeFieldChange(change: FieldChange): string {
	if (change.to !== null) {
		return `${change.field} to "${change.to}"`;
	}

	// A cleared icon falls back to the type's default; it has no manifest value to follow.
	return change.field === 'icon'
		? 'icon to the default'
		: `${change.field} to follow the manifest`;
}

export default describeFieldChange;
