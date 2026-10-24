export type RawValue = string | number | boolean | null | undefined | RawValue[] | RawObject;
export type RawObject = { [key: string]: RawValue };

/**
 * @description Checks whether a value from Discord is a plain record whose data can be shown.
 * @param value A sheet prop or a nested field.
 * @returns `true` for any non-null object that is not an array.
 */
export function isRawObject(value: unknown): value is RawObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sortValue(value: RawValue): RawValue {
	if (Array.isArray(value)) return value.map(sortValue);

	return isRawObject(value) ? sortKeys(value) : value;
}

/**
 * @description Copies an object with its keys in alphabetical order at every depth, so the JSON reads predictably.
 * @param object The record to sort.
 * @returns A sorted copy; array order is kept.
 */
export function sortKeys(object: RawObject): RawObject {
	const entries = Object.entries(object).sort(([left], [right]) => left.localeCompare(right));

	return Object.fromEntries(entries.map(([key, value]) => [key, sortValue(value)]));
}

/**
 * @description Copies a message without its author's private account fields and Discord's client-only bookkeeping.
 * @param message The message record from the action sheet.
 * @returns A sorted, JSON-safe copy of the message.
 */
export function cleanMessage(message: RawObject): RawObject {
	// The JSON round trip also turns timestamps into the strings the sheet shows.
	const clone: RawObject = JSON.parse(JSON.stringify(message));
	const { author, attachments } = clone;

	if (isRawObject(author)) {
		for (const field of ['email', 'phone', 'mfaEnabled', 'personalConnectionId']) {
			delete author[field];
		}
	}

	delete clone.editHistory;
	delete clone.deleted;
	delete clone.firstEditTimestamp;

	if (Array.isArray(attachments)) {
		for (const attachment of attachments) {
			if (isRawObject(attachment)) delete attachment.deleted;
		}
	}

	return sortKeys(clone);
}

export default { isRawObject, sortKeys, cleanMessage };
