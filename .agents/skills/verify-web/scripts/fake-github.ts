// Usage: bun fake-github.ts <port> <token>, run by launch.sh. Serves verify/addons and
// verify/first-party from real git repositories; <token> is the seeded users' linked GitHub token.
import { serveGitHub } from '../../../../apps/web/tests/helpers/github';

const REPOSITORY = 'verify/addons';
// launch.sh sets FIRST_PARTY_REPOSITORY to this; CI publishes its build tags without review.
const FIRST_PARTY = 'verify/first-party';

const port = Number(process.argv[2]);
const token = process.argv[3];

if (!Number.isInteger(port) || port <= 0 || !token) {
	throw new Error('Pass the port to serve the fake GitHub on and the token it accepts.');
}

function plugin(id: string, name: string, version: string, files: Record<string, string> = {}) {
	const manifest = {
		id,
		name,
		description: `${name}, served by the verify-web fake GitHub.`,
		authors: [{ name: 'Verify', id: '1234567890' }],
		version,
		main: 'src/index.ts',
		type: 'plugin',
	};

	const all: Record<string, string> = {
		'manifest.json': JSON.stringify(manifest, null, '\t'),
		'package.json': JSON.stringify({ scripts: { build: 'bun build src/index.ts' } }),
		'dist/index.js': `console.log('${id} ${version}');\n`,
		'ADDON.md': `# ${name}\n\nWhat ${name} does, as the author wrote it.\n`,
		'CHANGELOG.md': `# Changelog\n\n## [${version}] - 2026-10-20\n\n### Added\n\n- First release of ${name}.\n\n### Fixed\n\n- A crash on start.\n`,
		...files,
	};

	return Object.fromEntries(
		Object.entries(all).map(([file, content]) => [`plugins/${id}/${file}`, content]),
	);
}

const github = serveGitHub({
	port,
	repositories: {
		[REPOSITORY]: {
			description: 'Addons for verifying apps/web.',
			homepage: 'https://verify.example',
			topics: ['verify', 'unbound'],
			license: 'MIT',
			stars: 7,
			latestRelease: { tag: 'v1', name: 'First', publishedAt: '2026-10-20T12:00:00Z' },
		},
		[FIRST_PARTY]: { description: 'First-party addons CI publishes.', license: 'MIT' },
	},
	tokens: { [token]: { push: [REPOSITORY] } },
});

const fixture = github.repository(REPOSITORY);

fixture.commit({
	'README.md': '# verify/addons\n',
	'unbound.config.json': JSON.stringify({ addons: ['plugins/*'] }),
	...plugin('verify.new', 'Verify New', '0.1.0'),
	...plugin('verify.hello', 'Verify Hello', '1.1.0'),
	...plugin('verify.broken', 'Verify Broken', '0.1.0'),
});
fixture.commit({ 'plugins/verify.broken/dist/index.js': null });
fixture.tag('v1');

// Like plugins-publish.yml: the source on main, the build output on a commit only the build tag reaches.
const firstParty = github.repository(FIRST_PARTY);
const { 'plugins/verify.first/dist/index.js': bundle, ...source } = plugin(
	'verify.first',
	'Verify First',
	'0.1.0',
);
const main = firstParty.commit({
	'unbound.config.json': JSON.stringify({ addons: ['plugins/*'] }),
	...source,
});
const build = firstParty.commit(
	{ 'plugins/verify.first/dist/index.js': bundle ?? null },
	{ branch: null, parent: main },
);
const buildTag = `plugin-builds/${main}`;

firstParty.tag(buildTag, { at: build });

async function stop() {
	await github.stop();
	process.exit(0);
}

process.on('SIGTERM', () => void stop());
process.on('SIGHUP', () => void stop());

console.log(`fake GitHub serving ${REPOSITORY} on ${github.url.href} from ${fixture.dir}`);
console.log(
	`first-party build: ${JSON.stringify({ repository: FIRST_PARTY, path: 'plugins/verify.first', ref: buildTag, commitSha: build })}`,
);
