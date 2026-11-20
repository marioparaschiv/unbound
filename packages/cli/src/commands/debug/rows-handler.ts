import type { DevicePrelude } from '~/lib/device-prelude';
import { runOnDevice, toDeviceCode } from '~/lib/device';
import type { CommandHandler } from '~/lib/lazy-handler';

import type rowsCommand from './rows';

const CAPTURE_MS = 1_500;

type ChatRow = { message?: { id?: string } };

async function readRows(
	{ unbound }: DevicePrelude,
	messageId: string,
	captureMs: number,
): Promise<string> {
	const RowManager = unbound.metro.findByName('RowManager') as
		| { prototype: { generate: (...args: never[]) => ChatRow | undefined } }
		| undefined;

	if (!RowManager || typeof RowManager.prototype?.generate !== 'function') {
		throw new Error("Discord's RowManager is missing.");
	}

	const rows = new Map<string, ChatRow>();
	const unpatch = unbound.patcher.after(RowManager.prototype, 'generate', ({ result }) => {
		const id = result?.message?.id;

		if (typeof id === 'string' && (!messageId || id === messageId)) {
			rows.set(id, result);
		}
	});

	try {
		unbound.plugins.redrawChat?.();
		await new Promise((resolve) => setTimeout(resolve, captureMs));
	} finally {
		unpatch();
	}

	if (!rows.size) {
		throw new Error(
			messageId
				? `No row was generated for message ${messageId}; open its channel first.`
				: 'No row was generated; open a chat first.',
		);
	}

	const newest = [...rows.keys()].sort((a, b) => (BigInt(a) > BigInt(b) ? 1 : -1)).at(-1);

	return JSON.stringify(rows.get(messageId || newest || ''), null, 2);
}

const handler: CommandHandler<typeof rowsCommand.schema> = async ({ message }, { client }) =>
	runOnDevice(client, toDeviceCode(readRows, message ?? '', CAPTURE_MS), CAPTURE_MS + 10_000);

export default handler;
