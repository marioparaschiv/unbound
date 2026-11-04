import type { EmittedAsset, OutputBundle } from 'rollup';
import { Value } from 'typebox/value';

import type { ReportEntry, ReportGroup, ReportSection } from './build-report-schema.ts';

import { reportEntrySchema } from './build-report-schema.ts';

export type { ReportEntry, ReportSection };

/** Report entries ride the bundle as assets under this folder; the `build-report` plugin removes them before the write. */
export const REPORT_ENTRY_FOLDER = '.unbound-report/';

let emitted = 0;

/**
 * @description Wraps a report entry as an asset to pass to `this.emitFile`, from any hook up to `generateBundle`.
 * @param entry The line to add.
 * @returns The asset carrying the entry.
 * @example this.emitFile(reportLine({ section: 'inlined', label: 'svg', unit: '', bytes: xml.length }));
 */
export function reportLine(entry: ReportEntry): EmittedAsset {
	emitted += 1;

	return {
		type: 'asset',
		fileName: `${REPORT_ENTRY_FOLDER}${emitted}.json`,
		source: JSON.stringify(entry),
	};
}

/**
 * @description Removes every report entry from the bundle, so none is written to `dist`.
 * @param bundle The output bundle, in `generateBundle`.
 * @param warn Reports an entry that is not a valid {@link ReportEntry}, which is dropped.
 * @returns The entries, in emit order.
 */
export function takeReportEntries(
	bundle: OutputBundle,
	warn: (message: string) => void,
): ReportEntry[] {
	const entries: ReportEntry[] = [];

	for (const [fileName, file] of Object.entries(bundle)) {
		if (!fileName.startsWith(REPORT_ENTRY_FOLDER) || file.type !== 'asset') {
			continue;
		}

		// UNKNOWN: whatever a plugin emitted under the report folder, until the check below.
		const entry: unknown = JSON.parse(String(file.source));

		delete bundle[fileName];

		if (Value.Check(reportEntrySchema, entry)) {
			entries.push(entry);
		} else {
			warn(
				`Failed to read the build report entry ${fileName}: it is not a reportLine entry.`,
			);
		}
	}

	return entries;
}

/**
 * @description Merges entries with the same section and label into one report line each, in first-seen order.
 * @param entries The entries.
 * @param section The section to merge.
 * @returns The section's lines.
 */
export function mergeEntries(entries: ReportEntry[], section: ReportSection): ReportGroup[] {
	const groups = new Map<string, ReportGroup>();

	for (const entry of entries) {
		if (entry.section !== section) {
			continue;
		}

		const group = groups.get(entry.label) ?? {
			label: entry.label,
			items: 0,
			bytes: 0,
			tallies: {},
			locations: [],
			issues: {},
		};

		group.items += 1;
		group.bytes += entry.bytes ?? 0;
		group.unit ??= entry.unit;

		if (entry.tally) {
			group.tallies[entry.tally] = (group.tallies[entry.tally] ?? 0) + 1;
		}

		if (entry.location) {
			group.locations.push(entry.location);
		}

		if (entry.issue) {
			group.issues[entry.issue] = (group.issues[entry.issue] ?? 0) + 1;
		}

		groups.set(entry.label, group);
	}

	return [...groups.values()];
}

export default { REPORT_ENTRY_FOLDER, reportLine, takeReportEntries, mergeEntries };
