type Row = {
	type?: number;
};

type ChatManagerInstance = {
	setup(messages: Iterable<Row>): void;
	createRow(row: Row): void;
	createChangeset(): object;
};

type RowManagerInstance = {
	generate(message: Row): Row;
};

type ChatUpdatesQueueInstance = {
	add(changeset: object): void;
	tryFlush(): void;
};

type OpenChat = {
	chatManager: ChatManagerInstance | null;
	rowManager: RowManagerInstance | null;
	messages: Iterable<Row> | null;
	updatesQueue: ChatUpdatesQueueInstance | null;
};

declare global {
	var __unboundNoBlockedMessagesRuntime: OpenChat | undefined;
}

// Unbound evaluates the bundle again on each start; keeping the chat on `globalThis` lets a restart refresh it.
export const chat = (globalThis.__unboundNoBlockedMessagesRuntime ??= {
	chatManager: null,
	rowManager: null,
	messages: null,
	updatesQueue: null,
});

/**
 * @description Rebuilds every row of the open chat, so hiding or showing blocked messages applies without reopening it.
 */
export function refreshChat() {
	const { chatManager, rowManager, messages, updatesQueue } = chat;

	if (!chatManager || !rowManager || !messages || !updatesQueue) return;

	chatManager.setup(messages);

	for (const message of messages) chatManager.createRow(rowManager.generate(message));

	updatesQueue.add(chatManager.createChangeset());
	updatesQueue.tryFlush();
}
