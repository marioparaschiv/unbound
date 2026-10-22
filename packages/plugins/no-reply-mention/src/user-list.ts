export function parseUserList(value: unknown): string[] {
	if (typeof value !== 'string') return [];

	return [
		...new Set(
			value
				.split(/[\s,]+/)
				.map((entry) => entry.trim())
				.filter(Boolean),
		),
	];
}

export function isUserId(value: string): boolean {
	return /^\d{15,25}$/.test(value.trim());
}

function serializeUserList(userIds: string[]): string {
	return [...new Set(userIds.map((id) => id.trim()).filter(Boolean))].join('\n');
}

export function addUserId(value: unknown, userId: string): string {
	return serializeUserList([...parseUserList(value), userId]);
}

export function editUserId(value: unknown, currentUserId: string, nextUserId: string): string {
	return serializeUserList(
		parseUserList(value).map((id) => (id === currentUserId ? nextUserId : id)),
	);
}

export function removeUserId(value: unknown, userId: string): string {
	return serializeUserList(parseUserList(value).filter((id) => id !== userId));
}
