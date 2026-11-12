import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { bridgePortField } from '~/lib/context';
import { Type } from '~/lib/schema';

/** The API origin that renders the debug card when `--api` is not given. */
export const DEFAULT_API = 'https://unbound.rip';

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

const reportCommand: CommandDefinition<typeof schema> = {
	name: 'report',
	description:
		"Print the report /debug sends from the connected device, as the JSON the card endpoint takes and the image's alt text carries. " +
		'With --card, also render the card through the API and save it as a PNG, to check a report or a card change without posting in a channel.',
	summary: 'Print the /debug report and optionally render its card.',
	mcp: true,
	schema,
	handler: lazyHandler(() => import('./report-handler')),
};

export default reportCommand;
