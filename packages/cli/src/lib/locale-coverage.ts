import { isLocaleCode } from '@unbound-app/contracts/addon-locales';
import { IcuSyntaxError } from '@unbound-app/contracts/icu-parse';

import {
	keyLine,
	listTranslationCodes,
	readLocaleFile,
	readUntranslated,
	type LocaleFile,
} from '~/lib/locale-files';
import { readIcuMessage, type IcuArguments } from '~/rollup/icu-arguments';
import type { LocaleTable } from '~/rollup/locales';

/** A message that would misrender: bad ICU syntax, a missing `other` branch, or placeholders that differ from en-US. */
export type IcuProblem = { file: string; line: number; key: string } & (
	| { kind: 'syntax'; position: number; reason: string }
	| { kind: 'no-other'; argument: string }
	| { kind: 'placeholders'; found: string[]; expected: string[] }
);

/** How far one translation covers en-US. */
export type LocaleCoverage = {
	code: string;
	file: string;
	total: number;
	translated: number;
	percent: number;
	/** Keys en-US has and the file lacks. */
	missing: string[];
	/** Keys still holding the English stub `ubd i18n fix` wrote. */
	untranslated: string[];
	/** Keys the file has and en-US does not; the build leaves them out. */
	extra: string[];
	problems: IcuProblem[];
	/** Why the file could not be read at all. */
	error: string | undefined;
};

/** The coverage of every translation of one plugin. */
export type CoverageReport = {
	source: { file: string; total: number; problems: IcuProblem[] };
	locales: LocaleCoverage[];
};

type CheckedMessage = { arguments: IcuArguments | undefined; problems: IcuProblem[] };

function checkMessage(file: LocaleFile, key: string, message: string): CheckedMessage {
	const where = { file: file.file, line: keyLine(file.text, key), key };

	try {
		const read = readIcuMessage(message);

		return {
			arguments: read.arguments,
			problems: read.withoutOther.map((argument) => ({
				...where,
				kind: 'no-other',
				argument,
			})),
		};
	} catch (error) {
		const reason = (error as Error).message;
		const position = error instanceof IcuSyntaxError ? error.position : 0;

		return {
			arguments: void 0,
			problems: [{ ...where, kind: 'syntax', position, reason }],
		};
	}
}

function sameNames(left: IcuArguments, right: IcuArguments): boolean {
	return left.size === right.size && [...left.keys()].every((name) => right.has(name));
}

function emptyCoverage(file: LocaleFile, total: number, error: string): LocaleCoverage {
	return {
		code: file.code,
		file: file.file,
		total,
		translated: 0,
		percent: 0,
		missing: [],
		untranslated: [],
		extra: [],
		problems: [],
		error,
	};
}

function readCoverage(
	file: LocaleFile,
	source: LocaleTable,
	sourceArguments: Map<string, IcuArguments>,
	stubs: Record<string, string>,
): LocaleCoverage {
	const keys = Object.keys(source);

	if (!isLocaleCode(file.code)) {
		return emptyCoverage(
			file,
			keys.length,
			`${file.file} is not named after a Discord locale code, such as de.json or pt-BR.json`,
		);
	}

	const table = file.table;

	if (!table) {
		return emptyCoverage(file, keys.length, file.error ?? `${file.file} could not be read`);
	}

	const problems: IcuProblem[] = [];

	for (const [key, message] of Object.entries(table)) {
		const checked = checkMessage(file, key, message);
		const expected = sourceArguments.get(key);

		problems.push(...checked.problems);

		if (checked.arguments && expected && !sameNames(checked.arguments, expected)) {
			problems.push({
				file: file.file,
				line: keyLine(file.text, key),
				key,
				kind: 'placeholders',
				found: [...checked.arguments.keys()],
				expected: [...expected.keys()],
			});
		}
	}

	const missing = keys.filter((key) => table[key] === undefined);
	const untranslated = keys.filter(
		(key) => table[key] !== undefined && stubs[key] === table[key],
	);
	const translated = keys.length - missing.length - untranslated.length;

	return {
		code: file.code,
		file: file.file,
		total: keys.length,
		translated,
		percent: keys.length ? Math.floor((translated / keys.length) * 100) : 100,
		missing,
		untranslated,
		extra: Object.keys(table).filter((key) => source[key] === undefined),
		problems,
		error: void 0,
	};
}

/**
 * @description Measures every translation of a plugin against its en-US file, and checks every message's ICU syntax.
 * @param pluginRoot The plugin's directory.
 * @param sourceFile The plugin's en-US file, already read.
 * @param source Its messages.
 * @returns The report: en-US's own problems, then each translation's counts and problems.
 */
export function measureCoverage(
	pluginRoot: string,
	sourceFile: LocaleFile,
	source: LocaleTable,
): CoverageReport {
	const sourceArguments = new Map<string, IcuArguments>();
	const sourceProblems: IcuProblem[] = [];

	for (const [key, message] of Object.entries(source)) {
		const checked = checkMessage(sourceFile, key, message);

		sourceProblems.push(...checked.problems);

		if (checked.arguments) {
			sourceArguments.set(key, checked.arguments);
		}
	}

	const stubs = readUntranslated(pluginRoot);
	const locales = listTranslationCodes(pluginRoot).map((code) =>
		readCoverage(readLocaleFile(pluginRoot, code), source, sourceArguments, stubs[code] ?? {}),
	);

	return {
		source: {
			file: sourceFile.file,
			total: Object.keys(source).length,
			problems: sourceProblems,
		},
		locales,
	};
}

/**
 * @description Counts what fails `ubd i18n check`: ICU problems, extra keys and unreadable files, plus missing and
 * untranslated keys under `strict`.
 * @param report The coverage report.
 * @param strict Whether missing translations count too.
 * @returns The number of errors.
 */
export function countCoverageErrors(report: CoverageReport, strict: boolean): number {
	let errors = report.source.problems.length;

	for (const locale of report.locales) {
		errors += locale.problems.length + locale.extra.length + (locale.error ? 1 : 0);

		if (strict) {
			errors += locale.missing.length + locale.untranslated.length;
		}
	}

	return errors;
}
