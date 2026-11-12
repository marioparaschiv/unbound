import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { NOT_CONNECTED, evaluateOnDevice, toDeviceCode } from '~/lib/device';
import { readDebugReport } from '~/lib/debug-report';
import { bridgePortField } from '~/lib/context';
import { parse, Type } from '~/lib/schema';

const DEFAULT_API = 'https://unbound.rip';

const schema = Type.Object({
	port: bridgePortField,
	card: Type.Optional(
		Type.String({
			description: 'Also render the card through the API and write it as a PNG to this path.',
		}),
	),
	api: Type.Optional(
		Type.String({
			description: `The API origin that renders the card, such as a local web server. Defaults to ${DEFAULT_API}.`,
		}),
	),
});

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

const reportCommand: CommandDefinition<typeof schema> = {
	name: 'report',
	description:
		"Print the report /debug sends from the connected device, as the JSON the card endpoint takes and the image's alt text carries. " +
		'With --card, also render the card through the API and save it as a PNG, to check a report or a card change without posting in a channel.',
	summary: 'Print the /debug report and optionally render its card.',
	mcp: true,
	schema,
	async handler({ card, api = DEFAULT_API }, { client }) {
		const result = await evaluateOnDevice(client, toDeviceCode(readDebugReport), 20_000);

		if (!result) {
			return NOT_CONNECTED;
		}

		if (!result.ok) {
			return { ok: false, text: result.error };
		}

		const lines = [result.value];

		if (card) {
			lines.push(await writeCard(result.value, card, api));
		}

		return { ok: true, text: lines.join('\n\n'), data: JSON.parse(result.value) };
	},
};

export default reportCommand;
