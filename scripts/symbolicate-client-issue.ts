import { createSymbolicator } from '../packages/client/scripts/build/symbolicate';

const CLIENT_COMMIT = /\*\*Unbound:\*\*\s+v[\d.]+\s+\(`([0-9a-f]{7,40})`\)/;
const BYTECODE = /\(HBC (\d+)\)/;
const CLIENT_FRAME = /address at unbound:\d+:\d+/;
const MARKER = '<!-- unbound-client-symbolicated -->';
const DEFAULT_BYTECODE = '98';

/** What a crash issue needs for its client frames to be mapped. */
export type ClientCrash = { commit: string; bytecode: string; error: string };

/**
 * @description Finds the client commit, Hermes bytecode version and error stack in a crash issue's body.
 * @param body The issue body, as GitHub renders the crash form.
 * @returns The crash, or `undefined` when the stack has no client frames or the report names no commit.
 */
export function parseClientCrash(body: string): ClientCrash | undefined {
	const commit = CLIENT_COMMIT.exec(body)?.[1];
	const error = body.split(/^### /m).find((section) => section.startsWith('Error'));

	if (!commit || !error || !CLIENT_FRAME.test(error) || body.includes(MARKER)) {
		return undefined;
	}

	return {
		commit,
		bytecode: BYTECODE.exec(body)?.[1] ?? DEFAULT_BYTECODE,
		error: error.replace(/^Error\s*/, '').trim(),
	};
}

/**
 * @description Writes the comment that answers a crash issue with its client frames mapped to source.
 * @param commit The client revision the maps belong to.
 * @param mapped The error stack with client frames rewritten.
 * @returns The comment's Markdown.
 */
export function clientSymbolsComment(commit: string, mapped: string): string {
	return `${MARKER}\nUnbound's JavaScript frames, mapped with the source maps of \`${commit}\`:\n\n\`\`\`\n${mapped.replaceAll('```', '').trim()}\n\`\`\`\n`;
}

async function gh(...args: string[]): Promise<string> {
	return (await Bun.$`gh ${args}`.quiet().text()).trim();
}

async function main(repository: string, issue: string, dryRun: boolean): Promise<void> {
	const body = await gh(
		'issue',
		'view',
		issue,
		'--repo',
		repository,
		'--json',
		'body',
		'--jq',
		'.body',
	);
	const crash = parseClientCrash(body);

	if (!crash) {
		console.log('The issue has no client frames with a known commit; nothing to map.');

		return;
	}

	const sha = await gh('api', `repos/${repository}/commits/${crash.commit}`, '--jq', '.sha');
	const artifact = await gh(
		'api',
		`repos/${repository}/actions/artifacts?name=source-maps-${sha}`,
		'--jq',
		'.artifacts[0].id // empty',
	);

	if (!artifact) {
		console.log(`No source maps are kept for ${sha}.`);

		return;
	}

	const directory = `${process.env.RUNNER_TEMP ?? '/tmp'}/unbound-client-maps-${issue}`;

	await Bun.$`rm -rf ${directory} && mkdir -p ${directory}`.quiet();
	await Bun.$`gh api repos/${repository}/actions/artifacts/${artifact}/zip > ${directory}/maps.zip`.quiet();
	await Bun.$`unzip -q -o ${directory}/maps.zip -d ${directory}`.quiet();

	const mapped = createSymbolicator(`${directory}/unbound.${crash.bytecode}.bundle`)(crash.error);

	if (mapped === crash.error) {
		console.log('No client frame could be mapped.');

		return;
	}

	const comment = clientSymbolsComment(crash.commit, mapped);

	if (dryRun) {
		console.log(comment);

		return;
	}

	await Bun.write(`${directory}/comment.md`, comment);
	await gh(
		'issue',
		'comment',
		issue,
		'--repo',
		repository,
		'--body-file',
		`${directory}/comment.md`,
	);
}

if (import.meta.main) {
	const [repository, issue, flag] = Bun.argv.slice(2);

	if (!repository || !issue) {
		throw new Error(
			'Usage: bun scripts/symbolicate-client-issue.ts <owner/name> <issue> [--dry-run]',
		);
	}

	await main(repository, issue, flag === '--dry-run');
}
