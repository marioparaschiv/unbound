import { metro, patcher } from '@unbound-app/api';

type ChatManager = {
	setup(messages: Iterable<unknown>): void;
	createRow(row: unknown): void;
	createChangeset(): unknown;
};

type RowManager = {
	generate(row: unknown): unknown;
};

type ChatUpdatesQueue = {
	add(changeset: unknown): void;
	tryFlush(): void;
};

type ChatRuntime = {
	chatManager: ChatManager | null;
	rowManager: RowManager | null;
	messages: Iterable<unknown> | null;
	updatesQueue: ChatUpdatesQueue | null;
};

let unpatchCreateRow: (() => void) | null = null;
let unpatchChatManagerSetup: (() => void) | null = null;
let unpatchRowManagerGenerate: (() => void) | null = null;
let unpatchUpdatesQueueAdd: (() => void) | null = null;

function getRuntime(): ChatRuntime {
	const root = globalThis as Record<string, ChatRuntime | undefined>;

	return (root.__unboundNoBlockedMessagesRuntime ??= {
		chatManager: null,
		rowManager: null,
		messages: null,
		updatesQueue: null,
	});
}

function refreshRows(): void {
	const runtime = getRuntime();

	if (!runtime.chatManager || !runtime.rowManager || !runtime.messages || !runtime.updatesQueue)
		return;

	runtime.chatManager.setup(runtime.messages);
	for (const row of runtime.messages) {
		runtime.chatManager.createRow(runtime.rowManager.generate(row));
	}

	runtime.updatesQueue.add(runtime.chatManager.createChangeset());
	runtime.updatesQueue.tryFlush();
}

function installPatches(): void {
	const ChatManager = metro.find((module) => module?.default?.name === 'ChatManager')?.default;
	const RowManager = metro.find((module) => module?.default?.name === 'RowManager')?.default;
	const ChatUpdatesQueue = metro.find(
		(module) => module?.default?.name === 'ChatUpdatesQueue',
	)?.default;
	const runtime = getRuntime();

	if (ChatManager?.prototype?.createRow) {
		unpatchChatManagerSetup = patcher.before(ChatManager.prototype, 'setup', (context) => {
			runtime.chatManager = context.this as ChatManager;
			runtime.messages = context.args[0] as Iterable<unknown>;
		});

		unpatchCreateRow = patcher.instead(ChatManager.prototype, 'createRow', (context) => {
			if (context.args[0]?.type === 2) return;

			return context.original.apply(context.this, context.args);
		});
	}

	if (RowManager?.prototype?.generate) {
		unpatchRowManagerGenerate = patcher.before(RowManager.prototype, 'generate', (context) => {
			runtime.rowManager = context.this as RowManager;
		});
	}

	if (ChatUpdatesQueue?.prototype?.add) {
		unpatchUpdatesQueueAdd = patcher.before(ChatUpdatesQueue.prototype, 'add', (context) => {
			runtime.updatesQueue = context.this as ChatUpdatesQueue;
		});
	}

	refreshRows();
}

function removePatches(): void {
	unpatchCreateRow?.();
	unpatchCreateRow = null;
	refreshRows();
	unpatchChatManagerSetup?.();
	unpatchChatManagerSetup = null;
	unpatchRowManagerGenerate?.();
	unpatchRowManagerGenerate = null;
	unpatchUpdatesQueueAdd?.();
	unpatchUpdatesQueueAdd = null;
}

export default {
	start() {
		installPatches();
	},

	stop() {
		removePatches();
	},
};
