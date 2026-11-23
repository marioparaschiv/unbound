#!/usr/bin/env bun
// Screenshots every theme on the vphone in one run: installs them all, then applies each live and captures a
// server's channel list, Discord's settings and a DM at the device's native resolution.
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { isObject, parseJson, stringAt } from './json.ts';
import { HubError, type Vphone } from './vphone.ts';
import { connectVphone } from './session.ts';

/** Printed by --help and on a bad argument. */
const USAGE = `Screenshots every theme on the vphone in one run, for store pages. Claim the vphone first (claim.sh).
  theme-shots [--themes <dir>] [--only <slug,...>] [--out <dir>] [--guild <id>] [--dm <id>] [--icon-pack <id>] [--asset-base <url>] [--settle <ms>]
  --themes      folder of theme packages (default packages/themes)
  --only        comma-separated package folders to shoot (default all)
  --out         where <slug>/channels.jpg, settings.jpg and chat.jpg go (default /tmp/ubd-vphone/theme-shots)
  --guild       server whose channel list is shot (default Unbound, 950850315601711176)
  --dm          user or DM channel whose chat is shot (default eternal, 893933095164731503)
  --icon-pack   marketplace icon pack applied in every shot (default unbound.liquid-glass; none to skip)
  --asset-base  serve the repo's assets/themes/ backgrounds from this URL instead, for themes not yet on main
  --settle      ms to let each screen render before its shot (default 1500)
Images are the device's own 1290x2796 captures, written unchanged. Exit 0: every theme shot. 1: one failed.`;

type Options = {
	themes: string;
	only: string[] | undefined;
	out: string;
	guild: string;
	dm: string;
	iconPack: string | undefined;
	assetBase: string | undefined;
	settle: number;
};

type ThemePackage = { slug: string; id: string; name: string; manifest: string; bundle: string };

const ROOT = process.env.UNBOUND_CHECKOUT ?? process.cwd();
const REPO_ASSETS = 'https://raw.githubusercontent.com/marioparaschiv/unbound/main/assets/themes/';
const NAVIGATION =
	'const ref = unbound.metro.findByProps("getRootNavigationRef").getRootNavigationRef();';

function parse(argv: string[]): Options {
	const options: Options = {
		themes: join(ROOT, 'packages/themes'),
		only: undefined,
		out: '/tmp/ubd-vphone/theme-shots',
		guild: '950850315601711176',
		dm: '893933095164731503',
		iconPack: 'unbound.liquid-glass',
		assetBase: undefined,
		settle: 1500,
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		const value = argv[i + 1];

		if (!value) {
			throw new Error(`Unexpected argument ${arg}\n\n${USAGE}`);
		} else if (arg === '--themes') {
			options.themes = resolve(value);
		} else if (arg === '--only') {
			options.only = value.split(',');
		} else if (arg === '--out') {
			options.out = resolve(value);
		} else if (arg === '--guild') {
			options.guild = value;
		} else if (arg === '--dm') {
			options.dm = value;
		} else if (arg === '--icon-pack') {
			options.iconPack = value === 'none' ? undefined : value;
		} else if (arg === '--asset-base') {
			options.assetBase = value.endsWith('/') ? value : `${value}/`;
		} else if (arg === '--settle') {
			options.settle = Number(value);
		} else {
			throw new Error(`Unexpected argument ${arg}\n\n${USAGE}`);
		}

		i++;
	}

	return options;
}

function readThemes({ themes, only, assetBase }: Options): ThemePackage[] {
	const slugs =
		only ??
		readdirSync(themes).filter((slug) => existsSync(join(themes, slug, 'manifest.json')));

	return slugs.sort().map((slug) => {
		const manifest = readFileSync(join(themes, slug, 'manifest.json'), 'utf8');
		const parsed = parseJson(manifest, `${slug}/manifest.json`);
		const raw = readFileSync(join(themes, slug, 'bundle.json'), 'utf8');

		return {
			slug,
			id: stringAt(parsed, 'id') ?? slug,
			name: stringAt(parsed, 'name') ?? slug,
			manifest,
			bundle: assetBase ? raw.replaceAll(REPO_ASSETS, assetBase) : raw,
		};
	});
}

/** Runs code in Discord through the debugger bridge and returns its value; throws with the device's error. */
async function evaluate(code: string, timeout = 10_000): Promise<string> {
	const child = Bun.spawn(
		[
			'bun',
			'packages/cli/src/index.ts',
			'debug',
			'eval',
			code,
			'--json',
			'--timeout',
			String(timeout),
			'--port',
			process.env.UNBOUND_BRIDGE_PORT ?? '9090',
		],
		{ cwd: ROOT, stdout: 'pipe', stderr: 'pipe' },
	);
	const output = await new Response(child.stdout).text();

	await child.exited;

	const result = parseJson(output.trim() || 'null', 'the eval result');

	if (!isObject(result) || result.ok !== true) {
		throw new Error(
			`Failed to evaluate on device: ${stringAt(result, 'error') ?? output.trim()}`,
		);
	}

	return stringAt(result, 'value') ?? '';
}

/** Installs the icon pack from the marketplace if absent and applies it; returns device code that puts the previous pack back. */
async function applyIconPack(pack: string | undefined): Promise<string> {
	if (!pack) {
		return `'ok'`;
	}

	const id = JSON.stringify(pack);
	const [previous, present] = (
		await evaluate(
			`(unbound.iconPacks.getAll().find((p) => unbound.iconPacks.isEnabled(p.id))?.id ?? '') + ',' + Boolean(unbound.iconPacks.get(${id}))`,
		)
	).split(',');

	if (present !== 'true') {
		const installed = await evaluate(
			`String(await unbound.marketplace.install(${id}))`,
			120_000,
		);

		if (installed !== 'true') {
			throw new Error(`Failed to install icon pack ${pack} from the marketplace`);
		}
	}

	await evaluate(`await unbound.iconPacks.enable(${id}); 'ok'`, 60_000);

	const back = previous
		? `await unbound.iconPacks.enable(${JSON.stringify(previous)});`
		: `unbound.iconPacks.disable(${id});`;

	return present === 'true'
		? `${back} 'ok'`
		: `${back} await unbound.iconPacks.uninstall(${id}); 'ok'`;
}

async function capture(vphone: Vphone, file: string) {
	const shot = parseJson(
		await vphone.text('rpc', { method: 'screen.screenshot' }),
		'screen.screenshot',
	);
	const data = stringAt(shot, 'data');

	if (!data) {
		throw new Error('Failed to capture the screen: screen.screenshot returned no image');
	}

	await Bun.write(file, Buffer.from(data, 'base64'));
}

async function install(theme: ThemePackage) {
	const result = await evaluate(
		`const r = await unbound.themes.reload(${JSON.stringify(theme.id)}, ${JSON.stringify(theme.bundle)}, ${theme.manifest}); r.ok ? 'ok' : String(r.error)`,
	);

	if (result !== 'ok') {
		throw new Error(`Failed to install theme ${theme.id}: ${result}`);
	}
}

async function shoot(vphone: Vphone, theme: ThemePackage, { out, guild, dm, settle }: Options) {
	const dir = join(out, theme.slug);
	const wait = `await new Promise((done) => setTimeout(done, ${settle}));`;

	mkdirSync(dir, { recursive: true });

	await evaluate(
		`await unbound.themes.enable(${JSON.stringify(theme.id)}); ${NAVIGATION} ref.dispatch({ type: 'POP_TO_TOP' });
		unbound.metro.findByProps('transitionToGuild').transitionToGuild(${JSON.stringify(guild)}); ${wait} 'ok'`,
	);
	await capture(vphone, join(dir, 'channels.jpg'));

	await evaluate(
		`${NAVIGATION} ref.dispatch({ type: 'POP_TO_TOP' }); ref.navigate('settings'); ${wait} 'ok'`,
	);
	await capture(vphone, join(dir, 'settings.jpg'));

	// The id is a user or a DM channel; a user resolves to the DM open with them.
	await evaluate(
		`${NAVIGATION} ref.dispatch({ type: 'POP_TO_TOP' }); const id = ${JSON.stringify(dm)};
		const channel = unbound.metro.findByProps('getDMFromUserId').getDMFromUserId(id) ?? id;
		unbound.metro.findByProps('transitionToGuild', 'transitionTo').transitionTo('/channels/@me/' + channel); ${wait} 'ok'`,
	);
	await capture(vphone, join(dir, 'chat.jpg'));
	await evaluate(`${NAVIGATION} ref.dispatch({ type: 'POP_TO_TOP' }); 'ok'`);
}

async function main(argv: string[]): Promise<number> {
	if (argv.includes('-h') || argv.includes('--help')) {
		console.log(USAGE);

		return 0;
	}

	const options = parse(argv);
	const themes = readThemes(options);
	const applied = await evaluate(
		`unbound.themes.getAll().find((t) => unbound.themes.isEnabled(t.id))?.id ?? ''`,
	);
	const vphone = connectVphone();

	// Offline, Discord shows cached data such as an old profile; a first launch after an IPA install can hang identifying.
	const online = await evaluate(
		`const s = unbound.metro.findByProps('getSocket').getSocket();
		if (!s.isSessionEstablished()) { s.close(); s.connect(); }
		for (let i = 0; i < 30 && !s.isSessionEstablished(); i++) await new Promise((done) => setTimeout(done, 500));
		String(s.isSessionEstablished())`,
		30_000,
	);

	if (online !== 'true') {
		throw new Error(
			'Failed to connect Discord to the gateway: shots would show stale cached data',
		);
	}

	const restoreIconPack = await applyIconPack(options.iconPack);
	// Installing themes raises a reload toast that would sit over the first shots.
	const toasts = await evaluate(
		`const b = unbound.storage.getBucket('unbound'); const was = b.get('toasts.enabled'); b.set('toasts.enabled', false); String(was)`,
	);
	let failed = 0;
	let stopping = false;

	// Ctrl-C or kill stops after the current theme, so the restore below still runs.
	function stop() {
		stopping = true;
		console.error('stopping after the current theme; restoring the device');
	}

	process.on('SIGINT', stop);
	process.on('SIGTERM', stop);

	try {
		for (const theme of themes) {
			if (stopping) {
				break;
			}

			await install(theme);
		}

		console.log(`installed ${themes.length} themes`);

		for (const theme of themes) {
			if (stopping) {
				failed++;
				continue;
			}

			try {
				await shoot(vphone, theme, options);
				console.log(`shot ${theme.slug} (${theme.name})`);
			} catch (error) {
				failed++;
				console.error(
					`Failed to shoot theme ${theme.id}:`,
					error instanceof Error ? error.message : error,
				);
			}
		}
	} finally {
		// Put back whatever the device showed before the run.
		await evaluate(
			applied
				? `await unbound.themes.enable(${JSON.stringify(applied)}); 'ok'`
				: `const t = unbound.themes.getAll().find((t) => unbound.themes.isEnabled(t.id)); t && unbound.themes.disable(t.id); 'ok'`,
		).catch((error: Error) =>
			console.error('Failed to restore the applied theme:', error.message),
		);
		await evaluate(
			`unbound.storage.getBucket('unbound').set('toasts.enabled', ${toasts !== 'false'}); 'ok'`,
		).catch((error: Error) => console.error('Failed to restore toasts:', error.message));
		await evaluate(restoreIconPack, 60_000).catch((error: Error) =>
			console.error(`Failed to restore the icon pack:`, error.message),
		);
		vphone.close();
	}

	console.log(`wrote ${themes.length - failed} of ${themes.length} themes to ${options.out}`);

	return failed ? 1 : 0;
}

main(process.argv.slice(2)).then(
	(code) => process.exit(code),
	(error: Error) => {
		console.error(error.message);
		process.exit(error instanceof HubError ? 2 : 1);
	},
);
