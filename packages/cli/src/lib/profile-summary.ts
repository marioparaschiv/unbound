import { z } from 'zod';

const frameId = z.union([z.string(), z.number()]);

const stackFrameSchema = z.object({
	name: z.string().optional(),
	category: z.string().optional(),
	parent: frameId.optional(),
});

/** The parts of a Hermes sampled Chrome trace the summary reads. */
export const chromeTraceSchema = z.object({
	samples: z.array(z.object({ sf: frameId.optional() })).default([]),
	stackFrames: z.record(z.string(), stackFrameSchema).default({}),
});

type StackFrame = z.infer<typeof stackFrameSchema>;
type ChromeTrace = z.infer<typeof chromeTraceSchema>;

/** A JavaScript function's share of the recorded samples. */
export type ProfileEntry = {
	name: string;
	self: number;
	total: number;
};

/** What a sampled trace says about where the JavaScript thread spent its time. */
export type ProfileSummary = {
	samples: number;
	javaScriptSamples: number;
	functions: ProfileEntry[];
	sources: ProfileEntry[];
};

const NATIVE_FRAME_HOPS = 16;

function javaScriptFrame(frames: Record<string, StackFrame>, id: string | undefined) {
	let current = id;

	for (let hops = 0; current !== undefined && hops < NATIVE_FRAME_HOPS; hops++) {
		const frame = frames[current];

		if (!frame) {
			return undefined;
		}

		if (frame.category === 'JavaScript') {
			return current;
		}

		current = frame.parent === undefined ? undefined : String(frame.parent);
	}

	return undefined;
}

function sourceOf(name: string): string {
	const open = name.lastIndexOf('(');
	const location = open === -1 ? '' : name.slice(open + 1, -1);
	const position = /:\d+:\d+$/.exec(location);

	return (position ? location.slice(0, position.index) : location) || 'unknown';
}

function ranked(counts: Map<string, ProfileEntry>, top: number): ProfileEntry[] {
	return [...counts.values()]
		.sort((left, right) => right.self - left.self || right.total - left.total)
		.slice(0, top);
}

function count(counts: Map<string, ProfileEntry>, name: string, key: 'self' | 'total') {
	const entry = counts.get(name) ?? { name, self: 0, total: 0 };

	entry[key]++;
	counts.set(name, entry);
}

/**
 * @description Ranks the JavaScript functions and sources of a Hermes sampled trace by the samples they
 * ran in themselves, with the samples they were anywhere on the stack for.
 * @param trace The Chrome trace Hermes' sampling profiler dumped.
 * @param top How many functions and sources to keep.
 * @returns The ranked summary.
 */
export function summarizeProfile(trace: ChromeTrace, top: number): ProfileSummary {
	const frames = trace.stackFrames;
	const samples = trace.samples;
	const functions = new Map<string, ProfileEntry>();
	const sources = new Map<string, ProfileEntry>();
	let javaScriptSamples = 0;

	for (const sample of samples) {
		const leaf = javaScriptFrame(
			frames,
			sample.sf === undefined ? undefined : String(sample.sf),
		);

		if (leaf === undefined) {
			continue;
		}

		javaScriptSamples++;

		const leafName = frames[leaf]?.name ?? 'anonymous';

		count(functions, leafName, 'self');
		count(sources, sourceOf(leafName), 'self');

		const seenFunctions = new Set<string>();
		const seenSources = new Set<string>();

		for (let id: string | undefined = leaf; id !== undefined;) {
			const frame: StackFrame | undefined = frames[id];

			if (!frame) {
				break;
			}

			if (frame.category === 'JavaScript') {
				const name = frame.name ?? 'anonymous';

				seenFunctions.add(name);
				seenSources.add(sourceOf(name));
			}

			id = frame.parent === undefined ? undefined : String(frame.parent);
		}

		for (const name of seenFunctions) count(functions, name, 'total');

		for (const name of seenSources) count(sources, name, 'total');
	}

	return {
		samples: samples.length,
		javaScriptSamples,
		functions: ranked(functions, top),
		sources: ranked(sources, top),
	};
}

function percent(part: number, whole: number): string {
	return `${whole ? ((part / whole) * 100).toFixed(1) : '0.0'}%`;
}

function table(title: string, entries: ProfileEntry[], whole: number): string[] {
	return [
		title,
		...entries.map(
			(entry) =>
				`  ${percent(entry.self, whole).padStart(6)} self  ${percent(entry.total, whole).padStart(6)} total  ${entry.name}`,
		),
	];
}

/**
 * @description Renders a {@link ProfileSummary} as the text `ubd profile` prints.
 * @param summary The summary to render.
 * @returns The report.
 */
export function formatProfile(summary: ProfileSummary): string {
	if (!summary.javaScriptSamples) {
		return `Recorded ${summary.samples} samples, none of them in JavaScript: the JavaScript thread was idle.`;
	}

	return [
		`Recorded ${summary.samples} samples, ${summary.javaScriptSamples} in JavaScript.`,
		'',
		...table('Functions:', summary.functions, summary.javaScriptSamples),
		'',
		...table('Sources:', summary.sources, summary.javaScriptSamples),
	].join('\n');
}
