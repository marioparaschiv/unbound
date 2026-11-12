import { NOT_CONNECTED, evaluateOnDevice, toDeviceCode } from '~/lib/device';
import type { CommandHandler } from '~/lib/lazy-handler';
import { readDebugReport } from '~/lib/debug-report';
import { evalFailure } from '~/lib/command-error';
import { parse, Type } from '~/lib/schema';

import type reportCommand from './report';

import { DEFAULT_API } from './report';

const cardResponse = Type.Object({ image: Type.String(), altText: Type.String() });

async function writeCard(report: string, path: string, api: string): Promise<string> {
	const response = await fetch(new URL('/api/v1/debug-cards', api), {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: report,
	});

	if (!response.ok) {
		return `The card was not rendered: ${api} answered HTTP ${response.status}.`;
	}

	const card = parse(cardResponse, await response.json());

	await Bun.write(path, Buffer.from(card.image, 'base64'));

	return `Wrote the card to ${path}.`;
}

const handler: CommandHandler<typeof reportCommand.schema> = async (
	{ card, api = DEFAULT_API },
	{ client },
) => {
	const result = await evaluateOnDevice(client, toDeviceCode(readDebugReport), 20_000);

	if (!result) {
		return NOT_CONNECTED;
	}

	if (!result.ok) {
		return evalFailure(result);
	}

	const lines = [result.value];

	if (card) {
		lines.push(await writeCard(result.value, card, api));
	}

	return { ok: true, text: lines.join('\n\n'), data: JSON.parse(result.value) };
};

export default handler;
