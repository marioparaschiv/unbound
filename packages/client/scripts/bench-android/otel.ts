import { randomBytes } from 'node:crypto';

import type { LaunchRecord } from './report';

import { launchSpans, nestSpans, type TimedSpan } from './spans';

type AttributeValue = { stringValue: string } | { doubleValue: number } | { boolValue: boolean };

type Attributes = Record<string, string | number | boolean>;

/** A span with the attributes it is exported with. */
type Draft = TimedSpan & { attributes?: Attributes };

const SERVICE = 'unbound-client-bench';

const spanId = () => randomBytes(8).toString('hex');
const nanos = (ms: number) => BigInt(Math.round(ms * 1e6)).toString();

function attributes(values: Attributes) {
	return Object.entries(values).map(([key, value]) => {
		const typed: AttributeValue =
			typeof value === 'string'
				? { stringValue: value }
				: typeof value === 'boolean'
					? { boolValue: value }
					: { doubleValue: value };

		return { key, value: typed };
	});
}

/**
 * @description Turns one launch into an OTLP trace: the launch, its windows and every span the agent reported,
 * nested by time, each with its self time.
 * @param record The launch.
 * @param run The benchmark run's id, shared by its launches.
 * @returns The OTLP/JSON `ExportTraceServiceRequest`, or `undefined` when the launch has no agent report.
 */
export function launchTrace(record: LaunchRecord, run: string) {
	const { agent, processStart } = record;

	if (!agent || processStart === null) return;

	const common = { 'bench.run': run, 'bench.variant': record.variant };
	const root: Draft = {
		name: 'launch',
		start: processStart,
		end: agent.windows.at(-1)?.endEpoch ?? processStart,
		attributes: {
			'bench.index': record.index,
			'bench.valid': record.problems.length === 0,
			'bench.problems': record.problems.join('; '),
			...Object.fromEntries(
				Object.entries(agent.totals ?? {}).map(([name, [ms]]) => [
					`bench.total.${name}`,
					ms,
				]),
			),
		},
	};
	const windows: Draft[] = agent.windows.map((w) => ({
		name: `window ${w.name}`,
		start: w.startEpoch,
		end: w.endEpoch,
		attributes: {
			'bench.modules': w.modules.length,
			'bench.lag.max_ms': w.lag.max,
			'bench.lag.blocked_ms': w.lag.blocked,
		},
	}));
	const nested = nestSpans([root, ...windows, ...launchSpans(record)]);
	const ids = nested.map(spanId);
	const traceId = randomBytes(16).toString('hex');
	const events = Object.entries(agent.marks)
		.filter(([name]) => !/:(start|end)$/.test(name) || /^(ready|core|initialize)/.test(name))
		.map(([name, at]) => ({ name, timeUnixNano: nanos(at) }));
	const spans = nested.map((span, index) => ({
		traceId,
		spanId: ids[index],
		parentSpanId: span.parent === undefined ? '' : ids[span.parent],
		name: span.name,
		kind: 1,
		startTimeUnixNano: nanos(span.start),
		endTimeUnixNano: nanos(Math.max(span.end, span.start)),
		attributes: attributes({
			...common,
			...(span as Draft).attributes,
			'bench.kind': span.name.split(' ')[0] ?? span.name,
			'bench.self_ms': span.self,
		}),
		events: span.name === 'launch' ? events : [],
	}));

	return {
		resourceSpans: [
			{
				resource: { attributes: attributes({ 'service.name': SERVICE }) },
				scopeSpans: [{ scope: { name: 'bench-android' }, spans }],
			},
		],
	};
}

/**
 * @description Sends one launch's trace to an OTLP/HTTP collector; a failure is printed, never thrown.
 * @param endpoint The collector's base URL, such as `http://localhost:4318`.
 * @param record The launch.
 * @param run The benchmark run's id.
 */
export async function exportLaunch(endpoint: string, record: LaunchRecord, run: string) {
	const trace = launchTrace(record, run);

	if (!trace) return;

	try {
		const response = await fetch(`${endpoint.replace(/\/+$/, '')}/v1/traces`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(trace),
		});

		if (!response.ok) {
			console.error(`Failed to export launch ${record.index}: HTTP ${response.status}`);
		}
	} catch (error) {
		console.error(`Failed to export launch ${record.index}:`, error);
	}
}
