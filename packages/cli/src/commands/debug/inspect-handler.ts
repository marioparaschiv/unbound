import type { CommandOutput } from '@unbound-app/debugger-protocol/registry';

import { evaluateOnDevice, NOT_CONNECTED, toDeviceCode, type DeviceClient } from '~/lib/device';
import { formatClassReport, formatFoundViews, formatViewTree } from '~/lib/inspect-format';
import { inspectReportSchema, type InspectReport } from '~/lib/inspect-report';
import { inspectNative, type InspectRequest } from '~/lib/inspect-probe';
import { evalFailure, failure } from '~/lib/command-error';
import type { CommandHandler } from '~/lib/lazy-handler';
import type { StaticDecode } from '~/lib/schema';
import { parseJson } from '~/lib/parse-json';

import type inspectCommand from './inspect';

const CHUNK_SIZE = 100;

const handler: CommandHandler<typeof inspectCommand.schema> = async (input, { client }) =>
	runInspect(client, input);

/**
 * @description Runs one `ubd debug inspect` request on the device and formats what it reports.
 * @param client The bridge controller.
 * @param input The parsed command input.
 * @returns The formatted report with the raw report as data, or why it failed.
 */
export async function runInspect(
	client: DeviceClient,
	input: StaticDecode<typeof inspectCommand.schema>,
): Promise<CommandOutput> {
	const { what, name, class: rootClass, depth, max, filter, timeout } = input;
	const request = toRequest(what, name, rootClass, depth, max);

	if ('error' in request) {
		return failure('invalid-input', request.error, { field: 'name' });
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
		return evalFailure(result, result.error, result);
	}

	const report = parseJson(result.value, inspectReportSchema, 'The device');

	return report.ok
		? render(request, report.value, filter)
		: failure('device-error', report.error, { data: result });
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
				: { error: 'Pass the class to describe: ubd debug inspect class <name>.' };
		case 'find':
			return name
				? { kind: 'find', className: name, maxResults: 200, maxNodes, chunk: CHUNK_SIZE }
				: { error: 'Pass the class to look for: ubd debug inspect find <class>.' };
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
		return failure('not-found', report.error, { data: report });
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

export default handler;
