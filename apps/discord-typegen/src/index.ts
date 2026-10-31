import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { logger, CACHE_DIR, OUT_DIR, README, TYPES_DIR } from './paths';
import { runPipeline } from './pipeline';
import { loadHostProps } from './hosts';
import { splitModules } from './split';
import { EXTENSION } from './emit';

const BUILD_LINE = /^Generated from Discord build `[^`]*`\.$/m;

// Keeps the README's build line in step with the `DiscordBuild` type, so installers see which build the types describe.
function stampReadme(build: string) {
	const text = readFileSync(README, 'utf8');

	if (!BUILD_LINE.test(text)) {
		throw new Error(`'${README}' has no "Generated from Discord build" line to update.`);
	}

	writeFileSync(README, text.replace(BUILD_LINE, `Generated from Discord build \`${build}\`.`));
}

function latestBuild(): string {
	const builds = readdirSync(CACHE_DIR)
		.map((name) => /^discord-(\d+)$/.exec(name))
		.filter((match) => match !== null)
		.sort((a, b) => Number(b[1]) - Number(a[1]));

	if (!builds[0]) {
		throw new Error(
			`No decompiled build in '${CACHE_DIR}'. Decompile one with the hermes skill.`,
		);
	}

	return join(CACHE_DIR, builds[0][0]);
}

async function* readLines(path: string): AsyncGenerator<string> {
	const decoder = new TextDecoder();
	let rest = '';

	for await (const chunk of Bun.file(path).stream()) {
		const lines = (rest + decoder.decode(chunk, { stream: true })).split('\n');

		rest = lines.pop()!;

		yield* lines;
	}

	rest += decoder.decode();

	if (rest) {
		yield rest;
	}
}

async function generate() {
	const start = performance.now();
	const { values, positionals } = parseArgs({
		args: Bun.argv.slice(2),
		allowPositionals: true,
		options: { report: { type: 'string' }, out: { type: 'string' } },
	});
	const buildDir = resolve(positionals[0] ?? latestBuild());
	const outDir = resolve(values.out ?? OUT_DIR);
	const build = basename(buildDir);

	logger.info(`Generating Discord component types from ${buildDir}...`);

	const hosts = loadHostProps(TYPES_DIR);
	const { files, report } = await runPipeline(
		build,
		splitModules(readLines(join(buildDir, 'main.js'))),
		hosts,
	);

	mkdirSync(outDir, { recursive: true });

	for (const file of readdirSync(outDir)) {
		if (file.endsWith(EXTENSION)) {
			rmSync(join(outDir, file));
		}
	}

	for (const [file, text] of files) {
		writeFileSync(join(outDir, file), text);
	}

	if (outDir === OUT_DIR) {
		stampReadme(build);
	}

	if (values.report) {
		mkdirSync(dirname(resolve(values.report)), { recursive: true });
		writeFileSync(resolve(values.report), `${JSON.stringify(report, null, '\t')}\n`);
	}

	const seconds = ((performance.now() - start) / 1000).toFixed(1);
	const rss = Math.round(process.memoryUsage().rss / 1e6);

	logger.success(
		`Typed ${report.components} components (${report.exportedComponents} exported) of ${report.pascalCaseFunctions} PascalCase functions in ${report.modules} modules; ${report.typedProps}/${report.props} props (${report.typedPercent}%) typed beyond unknown. ${files.size} files in ${seconds}s, RSS ${rss} MB.`,
	);
}

if (import.meta.main) {
	generate().catch((error) => {
		logger.error('Failed to generate Discord component types:', error);
		process.exit(1);
	});
}
