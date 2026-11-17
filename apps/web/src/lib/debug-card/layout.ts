import type {
	DebugCardAddonCount as AddonCount,
	DebugCardRequest as DebugInfo,
	DebugCardSupport as DiscordSupport,
	DebugCardMemory,
	DebugCardNetwork,
	DebugCardLaunch,
} from '@unbound-app/contracts/debug-cards';
import { launchNotes } from '@unbound-app/contracts/debug-card-launch';

import type { DebugCardContext } from '~/lib/debug-card/context';

import { accent, cleanNames, COLORS, dim, joined, value, warn, type Span } from './spans';
import { dnsNote, gatewayNote, powerNote, pushNotes } from './device-notes';
import { storageMatters, storageSummary } from './storage';
import { environmentRows } from './environment-rows';
import { hookNotes } from './issue-notes';
import { accountNotes } from './account';
import { wrapped } from './wrap-lines';
import { tweakSpans } from './tweaks';

export { joined } from './spans';

/** A rounded rectangle, filled or outlined, in the card's points. */
export type CardRect = {
	kind: 'rect';
	x: number;
	y: number;
	width: number;
	height: number;
	radius: number;
	color: string;
	stroke?: boolean;
};

/** A filled circle. */
export type CardCircle = {
	kind: 'circle';
	x: number;
	y: number;
	radius: number;
	color: string;
};

/** One run of monospaced text, placed by its baseline. */
export type CardText = {
	kind: 'text';
	x: number;
	y: number;
	size: number;
	color: string;
	text: string;
};

export type CardOp = CardRect | CardCircle | CardText;

/** The debug card as drawing operations in points, rendered by each platform at `scale`. */
export type DebugCard = {
	width: number;
	height: number;
	scale: number;
	ops: CardOp[];
};

const WIDTH = 432;
const SCALE = 3;
const PADDING = 14;
const TITLE_HEIGHT = 28;
const FONT_SIZE = 13;
const LINE_HEIGHT = 22;
const CHAR_WIDTH = FONT_SIZE * 0.6;
const LABEL_WIDTH = 9;
const BADGE_CLEARANCE = 66;
const DAY_MS = 86_400_000;
const CRASH_WINDOW_MS = 7 * DAY_MS;
const FOOTER_HEIGHT = 52;

const DISCORD_TEAM = '53Q6R32WPB';
const SIDELOADERS = new Set(['AltStore/SideStore', 'AltStore', 'SideStore']);

type InstallParts = { signing: string; sideloader: string };

function installParts(details = ''): InstallParts {
	const parts = details.split(' · ').filter(Boolean);

	return {
		signing: parts.filter((part) => !SIDELOADERS.has(part)).join(' · '),
		sideloader: parts.filter((part) => SIDELOADERS.has(part)).join(' · '),
	};
}

const ENTERPRISE = /^Enterprise \(`([A-Z0-9]{10})`\)/;
const EXPIRY = / · exp(?:ires)? \d{4}-\d{2}-\d{2}/;

/**
 * @description Tells whether an install is signed with an enterprise certificate from a team other than Discord's.
 * Individuals cannot hold one, so such a certificate is always a stolen one passed around by signing services.
 * @param details The install's signing details.
 * @returns Whether it is.
 */
export function isStolenCertificate(details = ''): boolean {
	const team = ENTERPRISE.exec(details)?.[1];

	return team !== undefined && team !== DISCORD_TEAM;
}

function installSpans(details: string): Span[] {
	const stolen = isStolenCertificate(details);
	const shown = stolen ? details.replace(EXPIRY, '') : details.replace(' · expires ', ' · exp ');

	return [
		...shown
			.split('`')
			.map((part, index) => (index % 2 ? accent(part) : value(part)))
			.filter((span) => span.text),
		...(stolen ? [{ text: ' · stolen cert', color: COLORS.bad }] : []),
	];
}

const SUPPORT_COLORS: Record<DiscordSupport, string> = {
	supported: COLORS.good,
	untested: COLORS.warn,
	unsupported: COLORS.bad,
	broken: COLORS.bad,
};

function supportSpans(support?: DiscordSupport): Span[] {
	return support ? [dim(' · '), { text: support, color: SUPPORT_COLORS[support] }] : [];
}

function builtAgo(builtAt: string | undefined, now: Date): string | undefined {
	const at = builtAt ? Date.parse(builtAt) : Number.NaN;

	if (Number.isNaN(at)) {
		return undefined;
	}

	const minutes = Math.max(0, Math.round((now.getTime() - at) / 60_000));

	if (minutes < 60) {
		return `built ${minutes} min ago`;
	}

	const hours = Math.round(minutes / 60);

	return hours < 48 ? `built ${hours} h ago` : `built ${Math.round(hours / 24)} d ago`;
}

/**
 * @description Names a bundle that did not come from the release channel, with how long ago a dev bundle was built.
 * @param launch The loader's launch report.
 * @param builtAt When a local dev build of the bundle was made, as an ISO date.
 * @param now When the report was taken.
 * @returns `custom`, `dev`, `dev · built 3 min ago` or `pr #<n>`, or `undefined` for a release bundle.
 */
export function sourceLabel(
	launch: DebugCardLaunch | undefined,
	builtAt?: string,
	now: Date = new Date(),
): string | undefined {
	if (!launch?.source) {
		return undefined;
	}

	if (launch.source === 'pr' && launch.pullRequest) {
		return `pr #${launch.pullRequest}`;
	}

	const age = launch.source === 'dev' ? builtAgo(builtAt, now) : undefined;

	return age ? `${launch.source} · ${age}` : launch.source;
}

function sourceNote(
	launch: DebugCardLaunch | undefined,
	builtAt: string | undefined,
	now: Date,
): Span[] {
	const label = sourceLabel(launch, builtAt, now);

	return label ? [warn(` · ${label}`)] : [];
}

/**
 * @description Summarises the loader's last update check.
 * @param launch The loader's launch report.
 * @param now When the report was taken.
 * @returns The outcome, how long ago and any detail, or `undefined` without a check.
 */
export function lastCheckSummary(
	launch: DebugCardLaunch | undefined,
	now: Date,
): string | undefined {
	const check = launch?.lastCheck;

	if (!check) {
		return undefined;
	}

	const minutes = Math.max(0, Math.round((now.getTime() - check.at) / 60_000));
	const ago = minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;

	return [check.outcome, ago, check.detail].filter(Boolean).join(' · ');
}

/**
 * @description Lists the loader and client updates the server knows of, then the addon updates the client found waiting.
 * @param context What the server adds to the report.
 * @param addonUpdates The client's pending addon updates, each `name from → to`.
 * @returns One note per available update.
 */
export function updateNotes(context: DebugCardContext, addonUpdates: string[] = []): string[] {
	return [
		context.loaderUpdate && `loader ${context.loaderUpdate}`,
		context.clientUpdate && `client ${context.clientUpdate}`,
		...addonUpdates,
	].filter((note): note is string => typeof note === 'string');
}

/**
 * @description Decides the Discord support status, letting the compat scan override the client's guess.
 * @param info The report.
 * @param context What the server adds to the report.
 * @returns The status, or `undefined` when neither side knows.
 */
export function supportOf(info: DebugInfo, context: DebugCardContext): DiscordSupport | undefined {
	if (context.compat?.broken) {
		return 'broken';
	}

	if (context.compat && info.discordSupport !== 'unsupported') {
		return 'supported';
	}

	return info.discordSupport;
}

function rows(info: DebugInfo, now: Date, context: DebugCardContext): [string, Span[]][] {
	const { signing, sideloader } = installParts(info.installDetails);

	return [
		[
			'unbound',
			[
				value(info.client.replace(/^v/, '')),
				accent(` @${info.commit}`),
				...sourceNote(info.launch, info.bundleBuiltAt, now),
			],
		],
		['loader', [value(info.loader), dim(` ${joined([info.loaderOrigin, info.framework])}`)]],
		[
			'discord',
			[
				value(info.discord),
				dim(` ${joined([info.discordChannel.toLowerCase(), info.discordBuild])}`),
				...supportSpans(supportOf(info, context)),
			],
		],
		['source', [value(sideloader ? `Sideloaded (${sideloader})` : info.appSource)]],
		['device', [value(info.device)]],
		[
			'system',
			[
				value(`${info.platform} ${info.os}`),
				...(info.environment?.osBeta ? [warn(` · beta ${info.environment.osBeta}`)] : []),
			],
		],
		...(signing ? [['install', installSpans(signing)] as [string, Span[]]] : []),
		...environmentRows(info.environment),
		['react', [value(info.react), dim(` · react native ${info.reactNative}`)]],
		['hermes', [value(info.hermes), dim(` · bytecode ${info.bytecode}`)]],
		...diagnosticRows(info, now, context),
	];
}

type DebugCardCrash = NonNullable<DebugCardLaunch['crashes']>[number];

function crashSummary(crashes: DebugCardCrash[], now: Date): Span[] {
	const newest = crashes.at(-1);

	if (!newest || now.getTime() - newest.at > CRASH_WINDOW_MS) {
		return [];
	}

	const recent = crashes.filter((crash) => now.getTime() - crash.at <= DAY_MS).length;
	const when = recent
		? `${recent} in 24h`
		: `${Math.ceil((now.getTime() - newest.at) / DAY_MS)} d ago`;

	return [{ text: `${when} · ${newest.crash}`, color: recent ? COLORS.bad : COLORS.warn }];
}

function memoryNotes(memory?: DebugCardMemory): string[] {
	if (!memory) {
		return [];
	}

	const pressured =
		memory.lowMemory ||
		(memory.memoryWarnings ?? 0) > 0 ||
		memory.thermal === 'serious' ||
		memory.thermal === 'critical';

	if (!pressured) {
		return [];
	}

	const warnings = memory.memoryWarnings ?? 0;
	const notes = [
		memory.availableMB !== undefined && `${memory.availableMB} MB free`,
		memory.lowMemory && 'low memory',
		warnings > 0 && `${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`,
		memory.thermal && memory.thermal !== 'nominal' && `thermal ${memory.thermal}`,
	];

	return notes.filter((note): note is string => typeof note === 'string');
}

/**
 * @description Summarises the screen size, scale and accessibility settings.
 * @param display The display report.
 * @returns The summary.
 */
export function displaySummary(display: NonNullable<DebugInfo['display']>): string {
	return joined([
		`${display.width}x${display.height} @${display.scale}x`,
		`font ${display.fontScale}`,
		display.tablet ? 'tablet' : undefined,
		display.reduceMotion ? 'reduce motion' : undefined,
		display.boldText ? 'bold text' : undefined,
	]);
}

/**
 * @description Summarises how long the app has run and how often it was backgrounded.
 * @param session The session report.
 * @returns The summary.
 */
export function sessionSummary(session: NonNullable<DebugInfo['session']>): string {
	const hours = Math.floor(session.uptimeS / 3600);
	const minutes = Math.floor((session.uptimeS % 3600) / 60);
	const uptime = hours ? `${hours} h ${minutes} min` : `${minutes} min`;

	return `up ${uptime} · backgrounded ${session.backgrounded}`;
}

/**
 * @description Summarises the active connection: its type, then a metered plan, Low Data Mode, a VPN and a proxy when they apply.
 * @param network The network report.
 * @returns The summary, such as `wifi · VPN`.
 */
export function networkSummary(network: DebugCardNetwork): string {
	return [
		network.type,
		network.metered && network.type !== 'cellular' ? 'metered' : undefined,
		network.lowData ? 'low data' : undefined,
		network.vpn ? 'VPN' : undefined,
		network.proxy ? 'proxy' : undefined,
	]
		.filter(Boolean)
		.join(' · ');
}

/**
 * @description Summarises free memory, warnings and thermal state.
 * @param memory The memory report.
 * @returns The summary.
 */
export function memorySummary(memory: DebugCardMemory): string {
	return joined([
		memory.availableMB !== undefined ? `${memory.availableMB} MB free` : undefined,
		memory.lowMemory ? 'low memory' : undefined,
		memory.memoryWarnings ? `${memory.memoryWarnings} warnings` : undefined,
		memory.thermal ? `thermal ${memory.thermal}` : undefined,
	]);
}

function diagnosticRows(info: DebugInfo, now: Date, context: DebugCardContext): [string, Span[]][] {
	const crashes = crashSummary(info.launch?.crashes ?? [], now);
	const launch = launchNotes(info.launch);
	const memory = memoryNotes(info.memory);
	const hooks = hookNotes(info);
	const storage = storageMatters(info.storage) ? storageSummary(info.storage) : undefined;
	const updates = updateNotes(context, info.addonUpdates);
	const tweaks = cleanNames(info.injected ?? []);
	const push = pushNotes(info.push);
	const power = powerNote(info.power);
	const dns = dnsNote(info.dns);
	const gateway = gatewayNote(info.gateway);
	const candidates: [string, Span[]][] = [
		['crashes', crashes],
		['updates', updates.length ? [warn(joined(updates))] : []],
		['issues', info.disabledAddons?.length ? [warn(joined(info.disabledAddons))] : []],
		['tweaks', tweaks.length ? tweakSpans(tweaks) : []],
		['appex', extensionNotes(info).length ? [warn(joined(extensionNotes(info)))] : []],
		['hooks', hooks.length ? [warn(joined(hooks))] : []],
		['launch', launch.length ? [warn(joined(launch))] : []],
		['gateway', gateway ? [warn(joined([gateway]))] : []],
		['push', push.length ? [warn(joined(push))] : []],
		['memory', memory.length ? [warn(joined(memory))] : []],
		[
			'account',
			accountNotes(info.account).length ? [warn(joined(accountNotes(info.account)))] : [],
		],
		['storage', storage ? [warn(storage)] : []],
		['power', power ? [warn(power)] : []],
		['dns', dns ? [warn(dns)] : []],
	];

	return candidates.filter(([, spans]) => spans.length > 0);
}

const WORKS_WITHOUT_APP_GROUP = new Set(['OpenInDiscord', 'UnboundActivities']);

/**
 * @description Names the app's extensions that are broken: ones a sideloader stripped, and ones signed without the app
 * group that need it. OpenInDiscord only opens links and UnboundActivities only draws Live Activities, so neither needs
 * the app group and only a stripped one is named.
 * @param info The report.
 * @returns The extension names, each once.
 */
export function extensionNotes(info: DebugInfo): string[] {
	const isolated = (info.isolatedExtensions ?? []).filter(
		(name) => !WORKS_WITHOUT_APP_GROUP.has(name),
	);

	return [...new Set([...(info.missingExtensions ?? []), ...isolated])];
}

function addonSummaries({ plugins, themes }: DebugInfo): string[] {
	const counts: [string, AddonCount | undefined][] = [
		['plugins', plugins],
		['themes', themes],
	];
	const parts = counts.flatMap(([kind, count]) =>
		count?.installed ? [`${count.enabled}/${count.installed} ${kind}`] : [],
	);

	return parts.length > 1 ? [joined(parts), ...parts] : parts;
}

function timestamp(now: Date): string {
	return `${now.toISOString().slice(0, 16).replace('T', ' ')} utc`;
}

function textRuns(spans: Span[], x: number, y: number): CardText[] {
	let column = 0;

	return spans.map((span) => {
		const run: CardText = {
			kind: 'text',
			x: Math.round((x + column * CHAR_WIDTH) * 10) / 10,
			y,
			size: FONT_SIZE,
			color: span.color,
			text: span.text,
		};

		column += span.text.length;

		return run;
	});
}

function stateLabel(flag: string, jailbreak = ''): string {
	return ((flag === 'Jailbroken' || flag === 'Rooted') && jailbreak ? jailbreak : flag)
		.replace(/ build$/, '')
		.toLowerCase();
}

function stateSpans(flags: string[], jailbreak?: string): Span[] {
	return flags.map((flag, index) => {
		const color =
			flag === 'verified build'
				? COLORS.good
				: flag === 'unverified build'
					? COLORS.warn
					: COLORS.dim;

		return { text: `${index ? '  ' : ''}● ${stateLabel(flag, jailbreak)}`, color };
	});
}

function spansLength(spans: Span[]): number {
	return spans.reduce((length, span) => length + span.text.length, 0);
}

function stateRowSpans(spans: Span[]): Span[] {
	return spans.flatMap((span, index) => [
		...(index ? [dim(' · ')] : []),
		{ ...span, text: span.text.replace(/^\s*● /, '') },
	]);
}

/**
 * @description Lays the debug report out as a terminal-style card: a title bar, one aligned row per component and the report time and a state footer that leaves room on the left for Discord's ALT badge.
 * @param info The versions and device details.
 * @param now When the report was taken, shown in the title bar.
 * @param context What the server adds: the compat scan and whether the client or loader is behind.
 * @returns The card's size, render scale and drawing operations.
 */
export function layoutDebugCard(
	info: DebugInfo,
	now = new Date(),
	context: DebugCardContext = {},
): DebugCard {
	const room = Math.floor((WIDTH - PADDING * 2) / CHAR_WIDTH);
	const valueRoom = room - LABEL_WIDTH;
	const valueX = PADDING + LABEL_WIDTH * CHAR_WIDTH;
	const footerRoom = Math.floor((WIDTH - PADDING - BADGE_CLEARANCE) / CHAR_WIDTH);
	const allState = stateSpans(info.flags, info.jailbreak);
	const stateFits = spansLength(allState) <= footerRoom;
	const state = stateFits ? allState : [];
	const stateRow: [string, Span[]][] = stateFits ? [] : [['state', stateRowSpans(allState)]];
	const lines = [...rows(info, now, context), ...stateRow].flatMap(([label, spans]) =>
		wrapped(spans, valueRoom).map((line, index) => ({ label: index ? '' : label, line })),
	);
	const footerTop = TITLE_HEIGHT + PADDING + lines.length * LINE_HEIGHT + PADDING / 2;
	const height = footerTop + FOOTER_HEIGHT;
	const footerBaseline = footerTop + FOOTER_HEIGHT / 2 + 4;
	const stamp = timestamp(now);
	const ops: CardOp[] = [
		{
			kind: 'rect',
			x: 0,
			y: 0,
			width: WIDTH,
			height,
			radius: 8,
			color: COLORS.background,
		},
		{
			kind: 'rect',
			x: 0,
			y: 0,
			width: WIDTH,
			height: TITLE_HEIGHT,
			radius: 8,
			color: COLORS.titleBar,
		},
		{
			kind: 'rect',
			x: 0,
			y: TITLE_HEIGHT - 8,
			width: WIDTH,
			height: 8,
			radius: 0,
			color: COLORS.titleBar,
		},
		{
			kind: 'circle',
			x: 16,
			y: TITLE_HEIGHT / 2,
			radius: 4.5,
			color: COLORS.bad,
		},
		{
			kind: 'circle',
			x: 30,
			y: TITLE_HEIGHT / 2,
			radius: 4.5,
			color: COLORS.warn,
		},
		{
			kind: 'circle',
			x: 44,
			y: TITLE_HEIGHT / 2,
			radius: 4.5,
			color: COLORS.good,
		},
		...textRuns([dim('unbound /debug')], 60, TITLE_HEIGHT / 2 + 4),
		...textRuns(
			[dim(stamp)],
			WIDTH - PADDING - stamp.length * CHAR_WIDTH,
			TITLE_HEIGHT / 2 + 4,
		),
	];

	for (const [index, { label, line }] of lines.entries()) {
		const baseline = TITLE_HEIGHT + PADDING + index * LINE_HEIGHT + FONT_SIZE;

		ops.push(...textRuns([{ text: label, color: COLORS.label }], PADDING, baseline));
		ops.push(...textRuns(line, valueX, baseline));
	}

	const stateLength = spansLength(state);
	const summary = addonSummaries(info).find(
		(candidate) => stateLength + 2 + candidate.length <= footerRoom,
	);

	ops.push(
		{
			kind: 'rect',
			x: 0,
			y: footerTop,
			width: WIDTH,
			height: FOOTER_HEIGHT,
			radius: 8,
			color: COLORS.titleBar,
		},
		{
			kind: 'rect',
			x: 0,
			y: footerTop,
			width: WIDTH,
			height: 8,
			radius: 0,
			color: COLORS.titleBar,
		},
		...textRuns(state, BADGE_CLEARANCE, footerBaseline),
		...(summary
			? textRuns(
					[dim(summary)],
					WIDTH - PADDING - summary.length * CHAR_WIDTH,
					footerBaseline,
				)
			: []),
		{
			kind: 'rect',
			x: 0.5,
			y: 0.5,
			width: WIDTH - 1,
			height: height - 1,
			radius: 8,
			color: COLORS.border,
			stroke: true,
		},
	);

	return { width: WIDTH, height, scale: SCALE, ops };
}

function escapeXml(text: string): string {
	return text.replace(/[<>&"]/g, (character) => `&#${character.charCodeAt(0)};`);
}

/**
 * @description Writes the card as SVG in JetBrains Mono, for the server to render as a PNG.
 * @param card The laid-out card.
 * @returns The SVG document.
 */
export function debugCardSvg(card: DebugCard): string {
	const shapes = card.ops.map((op) => {
		if (op.kind === 'circle') {
			return `<circle cx="${op.x}" cy="${op.y}" r="${op.radius}" fill="${op.color}"/>`;
		}

		if (op.kind === 'rect') {
			const paint = op.stroke ? `fill="none" stroke="${op.color}"` : `fill="${op.color}"`;

			return `<rect x="${op.x}" y="${op.y}" width="${op.width}" height="${op.height}" rx="${op.radius}" ${paint}/>`;
		}

		return `<text x="${op.x}" y="${op.y}" font-size="${op.size}" fill="${op.color}" xml:space="preserve">${escapeXml(op.text)}</text>`;
	});

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${card.width}" height="${card.height}" viewBox="0 0 ${card.width} ${card.height}" font-family="JetBrains Mono">`,
		...shapes,
		'</svg>',
	].join('');
}

export default { debugCardSvg, layoutDebugCard };
