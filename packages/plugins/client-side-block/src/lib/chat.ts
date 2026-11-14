type Row = {
	type?: number;
	id?: unknown;
	content?: { id?: unknown } | null;
};

export type ChatManagerInstance = {
	setup(messages: unknown): void;
	createRow(row: Row): void;
	createChangeset(): object;
};

export type RowManagerInstance = {
	generate(message: Row): Row;
};

export type ChatUpdatesQueueInstance = {
	add(changeset: object): void;
	tryFlush(): void;
};

type OpenChat = {
	chatManager: ChatManagerInstance | null;
	rowManager: RowManagerInstance | null;
	messages: unknown;
	updatesQueue: ChatUpdatesQueueInstance | null;
	/** The channel stream items Discord turned into rows in its last rebuild: messages, dividers and the rest. */
	items: Row[];
	/** Whether Discord is between `setup` and `createChangeset`, so its `generate` calls are recorded. */
	recording: boolean;
	/** Whether `refreshChat` is replaying the items, so its own calls are not recorded. */
	refreshing: boolean;
	/** The row manager whose items the rebuild records; another chat's manager can generate rows in between. */
	recordingManager: RowManagerInstance | null;
};

declare global {
	var __unboundClientSideBlockRuntime: OpenChat | undefined;
}

// Unbound evaluates the bundle again on each start; keeping the chat on `globalThis` lets a restart refresh it.
const emptyChat = (): OpenChat => ({
	chatManager: null,
	rowManager: null,
	messages: null,
	updatesQueue: null,
	items: [],
	recording: false,
	refreshing: false,
	recordingManager: null,
});

const runtime = (globalThis.__unboundClientSideBlockRuntime ??= emptyChat());

// An update applied without restarting Discord finds the older version's object, so fields it lacks are filled in.
export const chat = Object.assign(runtime, { ...emptyChat(), ...runtime });

/**
 * @description Starts recording a rebuild Discord begins with `setup`, unless it is `refreshChat`'s own replay.
 * @param messages The channel's messages Discord passes to `setup`.
 */
export function beginRebuild(messages: unknown): void {
	if (chat.refreshing) return;

	chat.messages = messages;
	chat.items = [];
	chat.recordingManager = null;
	chat.recording = true;
}

function itemKey(item: Row): unknown {
	const id = item.content?.id ?? item.id;

	return id === undefined ? item : `${item.type}:${String(id)}`;
}

/**
 * @description Records a channel stream item Discord turns into a row during its rebuild, once, and only from the row
 * manager that started generating for it.
 * @param item The item `generate` received.
 * @param manager The row manager generating it.
 */
export function recordItem(item: Row, manager: RowManagerInstance): void {
	if (!chat.recording || chat.refreshing) return;

	chat.recordingManager ??= manager;

	if (manager !== chat.recordingManager) return;

	const key = itemKey(item);

	if (chat.items.some((recorded) => itemKey(recorded) === key)) return;

	chat.items.push(item);
}

/**
 * @description Stops recording once Discord asks for the rebuild's changeset.
 */
export function endRebuild(): void {
	if (!chat.refreshing) chat.recording = false;
}

/**
 * @description Rebuilds every row of the open chat from the items of Discord's last rebuild, the way Discord does, so hiding
 * or showing blocked messages applies without reopening it.
 */
export function refreshChat() {
	const { chatManager, messages, updatesQueue, items } = chat;
	const rowManager = chat.recordingManager ?? chat.rowManager;

	if (!chatManager || !rowManager || !updatesQueue || !items.length || chat.recording) return;

	chat.refreshing = true;

	try {
		chatManager.setup(messages);

		for (const item of items) chatManager.createRow(rowManager.generate(item));

		updatesQueue.add(chatManager.createChangeset());
		updatesQueue.tryFlush();
	} finally {
		chat.refreshing = false;
	}
}
