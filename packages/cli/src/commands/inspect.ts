import type { CommandDefinition, CommandOutput } from '@unbound-app/debugger-protocol/registry';
import { MAX_EVAL_TIMEOUT_MS } from '@unbound-app/debugger-protocol';
import { z } from 'zod';

import { evaluateOnDevice, NOT_CONNECTED, toDeviceCode, type DeviceClient } from '~/lib/device';
import { formatClassReport, formatFoundViews, formatViewTree } from '~/lib/inspect-format';
import { inspectReportSchema, type InspectReport } from '~/lib/inspect-report';
import { inspectNative, type InspectRequest } from '~/lib/inspect-probe';
import { bridgePortField } from '~/lib/context';
import { parseJson } from '~/lib/parse-json';

const WALK_TIMEOUT_MS = 60_000;
const CHUNK_SIZE = 100;

const schema = z.object({
	what: z.enum(['class', 'views', 'find']).describe('What to inspect: class, views or find.'),
	name: z.string().default('').describe('The class to describe (class) or to look for (find).'),
	class: z
		.string()
		.default('')
		.describe('For views: dump only the subtrees of attached views of this class.'),
	depth: z.number().int().positive().default(40).describe('For views: how deep to print.'),
	max: z.number().int().positive().default(2000).describe('How many views to visit at most.'),
	filter: z
		.string()
		.default('')
		.describe(
			'For class: keep only constructors, methods and fields whose name contains this.',
		),
	port: bridgePortField,
	timeout: z
		.number()
		.int()
		.positive()
		.max(MAX_EVAL_TIMEOUT_MS)
		.default(WALK_TIMEOUT_MS)
		.describe('How long the device may take, in milliseconds.'),
});

const inspectCommand: CommandDefinition<typeof schema> = {
	name: 'inspect',
	description:
		'Inspect native code on the connected device. `class <name>` describes a Java class: its ' +
		'superclasses, constructors, methods with static markers and fields (iOS: the superclass chain). ' +
		"`views [--class <name>] [--depth n]` dumps the current activity's view tree with class names, " +
		'resource ids, sizes, visibility and text. `find <class>` lists the attached views of a class. ' +
		'It reads through a running plugin that holds native access.',
	surfaces: { cli: 'root', mcp: true },
	schema,
	cli: { positionals: ['what', 'name'] },
	handler(input, { client }) {
		return runInspect(client, input);
	},
};

/**
 * @description Runs one `ubd inspect` request on the device and formats what it reports.
 * @param client The bridge controller.
 * @param input The parsed command input.
 * @returns The formatted report with the raw report as data, or why it failed.
 */
export async function runInspect(
	client: DeviceClient,
	input: z.infer<typeof schema>,
): Promise<CommandOutput> {
	const { what, name, class: rootClass, depth, max, filter, timeout } = input;
	const request = toRequest(what, name, rootClass, depth, max);

	if ('error' in request) {
		return { ok: false, text: request.error };
	}

	const result = await evaluateOnDevice(
		client,
		`(async () => JSON.stringify(await ${toDeviceCode(inspectNative, request)}))()`,
		timeout,
	);

	if (!result) {
		return NOT_CONNECTED;
	}

	if (!result.ok) {
		return { ok: false, text: result.error, data: result };
	}

	const report = parseJson(result.value, inspectReportSchema, 'The device');

	return report.ok
		? render(request, report.value, filter)
		: { ok: false, text: report.error, data: result };
}

function toRequest(
	what: 'class' | 'views' | 'find',
	name: string,
	rootClass: string,
	maxDepth: number,
	maxNodes: number,
): InspectRequest | { error: string } {
	switch (what) {
		case 'class':
			return name
				? { kind: 'class', name }
				: { error: 'Pass the class to describe: ubd inspect class <name>.' };
		case 'find':
			return name
				? { kind: 'find', className: name, maxResults: 200, maxNodes, chunk: CHUNK_SIZE }
				: { error: 'Pass the class to look for: ubd inspect find <class>.' };
		case 'views':
			return {
				kind: 'views',
				className: rootClass || name,
				maxDepth,
				maxNodes,
				chunk: CHUNK_SIZE,
			};
	}
}

function render(request: InspectRequest, report: InspectReport, filter: string): CommandOutput {
	if ('error' in report) {
		return { ok: false, text: report.error, data: report };
	}

	if ('members' in report) {
		return { ok: true, text: formatClassReport(report, filter), data: report };
	}

	return {
		ok: true,
		text:
			request.kind === 'find'
				? formatFoundViews(report, request.className)
				: formatViewTree(report, request.kind === 'views' ? request.className : ''),
		data: report,
	};
}

export default inspectCommand;
