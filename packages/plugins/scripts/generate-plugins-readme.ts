import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const pluginsDir = repoRoot;
const iconsDir = resolve(repoRoot, '../../assets/plugins/icons');
const catalogPath = resolve(repoRoot, 'catalog.svg');
const readmePath = resolve(repoRoot, 'README.md');
const catalogInset = 30;
const pluginColumnWidth = 300;
const descriptionColumnWidth = 560;
const versionColumnWidth = 100;
const authorColumnWidth = 180;
const catalogWidth =
	catalogInset * 2 +
	pluginColumnWidth +
	descriptionColumnWidth +
	versionColumnWidth +
	authorColumnWidth;
const rowStart = 150;

interface PluginAuthor {
	name: string;
	id: string;
}

interface PluginManifest {
	id: string;
	icon: string;
	name: string;
	description: string;
	version: string;
	authors: PluginAuthor[];
}

interface PluginInfo {
	folder: string;
	manifest: PluginManifest;
}

interface CatalogRow {
	plugin: PluginInfo;
	descriptionLines: string[];
	authorLines: string[];
	height: number;
	y: number;
}

function escapeXml(value: string): string {
	return value.replace(/[<>&"']/g, (character) => {
		const escaped: Record<string, string> = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&apos;',
		};

		return escaped[character];
	});
}

function repositoryTitle(): string {
	const repository =
		process.env.GITHUB_REPOSITORY ??
		execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: repoRoot, encoding: 'utf8' });
	const match = /(?:^|[:/])([^/:]+)\/([^/]+?)(?:\.git)?\/?$/.exec(repository.trim());
	if (!match) throw new Error('Could not determine the repository owner and name.');
	return `${match[1]}/${match[2]}`;
}

function wrapText(value: string, limit: number): string[] {
	const lines: string[] = [];
	let line = '';

	for (const word of value.split(/\s+/)) {
		const candidate = line ? `${line} ${word}` : word;
		if (candidate.length > limit && line) {
			lines.push(line);
			line = word;
			continue;
		}

		line = candidate;
	}

	if (line) lines.push(line);
	return lines;
}

function readPluginManifests(): PluginInfo[] {
	const plugins: PluginInfo[] = [];

	for (const entry of readdirSync(pluginsDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;

		const folder = entry.name;
		const manifestPath = resolve(pluginsDir, folder, 'manifest.json');
		if (!existsSync(manifestPath)) continue;

		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as PluginManifest;
		if (!manifest.icon) throw new Error(`Plugin ${manifest.id} is missing a manifest icon.`);
		if (!/^[A-Za-z0-9_-]+$/.test(manifest.icon))
			throw new Error(`Plugin ${manifest.id} has an invalid icon name: ${manifest.icon}.`);

		plugins.push({ folder, manifest });
	}

	return plugins.sort((first, second) => first.manifest.name.localeCompare(second.manifest.name));
}

function readIconData(plugins: PluginInfo[]): Map<string, string> {
	const icons = new Map<string, string>();

	for (const { manifest } of plugins) {
		if (icons.has(manifest.icon)) continue;

		const iconPath = resolve(iconsDir, `${manifest.icon}.png`);
		if (!existsSync(iconPath))
			throw new Error(
				`Plugin icon ${manifest.icon} is missing; sync icons from the latest loader IPA.`,
			);

		icons.set(manifest.icon, readFileSync(iconPath).toString('base64'));
	}

	return icons;
}

function createRows(plugins: PluginInfo[]): CatalogRow[] {
	let y = rowStart;

	return plugins.map((plugin) => {
		const authors = plugin.manifest.authors.map((author) => author.name).join(', ');
		const descriptionLines = wrapText(plugin.manifest.description, 72);
		const authorLines = wrapText(authors, 23);
		const lineCount = Math.max(descriptionLines.length, authorLines.length, 1);
		const height = Math.max(52, 20 + lineCount * 18);
		const row = { plugin, descriptionLines, authorLines, height, y };
		y += height;
		return row;
	});
}

function renderLines(
	lines: string[],
	x: number,
	centerY: number,
	fontSize: number,
	fill: string,
	fontWeight: number = 400,
	textAnchor: 'start' | 'middle' = 'start',
): string[] {
	const lineHeight = 18;
	const firstY = centerY - ((lines.length - 1) * lineHeight) / 2;

	return lines.map(
		(line, index) =>
			`<text x="${x}" y="${firstY + index * lineHeight}" text-anchor="${textAnchor}" dominant-baseline="middle" fill="${fill}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="${fontSize}" font-weight="${fontWeight}">${escapeXml(line)}</text>`,
	);
}

function renderCatalog(plugins: PluginInfo[], icons: Map<string, string>): string {
	const title = escapeXml(repositoryTitle());
	const rows = createRows(plugins);
	const height = rows.reduce((total, row) => total + row.height, rowStart + 20);
	const descriptionX = catalogInset + pluginColumnWidth;
	const versionX = descriptionX + descriptionColumnWidth;
	const authorX = versionX + versionColumnWidth;
	const rowMarkup = rows.flatMap((row, index) => {
		const { plugin, descriptionLines, authorLines, height: rowHeight, y } = row;
		const centerY = y + rowHeight / 2;
		const iconBase64 = icons.get(plugin.manifest.icon);
		if (!iconBase64) throw new Error(`Plugin icon ${plugin.manifest.icon} has no image data.`);

		const pluginLink = `https://github.com/marioparaschiv/unbound/tree/main/packages/plugins/${plugin.folder}`;
		const rowFill = index % 2 === 0 ? '#17181c' : '#121316';
		const rowElements = [
			`<rect x="16" y="${y}" width="1168" height="${rowHeight}" rx="8" fill="${rowFill}"/>`,
			`<rect x="${catalogInset + 10}" y="${centerY - 15}" width="30" height="30" rx="7" fill="#313338"/>`,
			`<image x="${catalogInset + 13}" y="${centerY - 12}" width="24" height="24" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${iconBase64}"/>`,
			`<a href="${escapeXml(pluginLink)}">${renderLines([plugin.manifest.name], catalogInset + 50, centerY, 15, '#f5f5f7', 600).join('')}</a>`,
			...renderLines(descriptionLines, descriptionX + 16, centerY, 13, '#c6c6cc'),
			...renderLines(
				[plugin.manifest.version],
				versionX + versionColumnWidth / 2,
				centerY,
				13,
				'#c6c6cc',
				400,
				'middle',
			),
			...renderLines(authorLines, authorX + 12, centerY, 13, '#98989f'),
			`<line x1="${catalogInset}" y1="${y + rowHeight}" x2="${catalogWidth - catalogInset}" y2="${y + rowHeight}" stroke="#2a2d33" stroke-width="1"/>`,
		];

		return rowElements;
	});

	const headerLines = [
		`<text x="${catalogInset + 12}" y="${rowStart - 18}" dominant-baseline="middle" fill="#98989f" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="11" font-weight="600" letter-spacing="1">PLUGIN</text>`,
		`<text x="${descriptionX + 16}" y="${rowStart - 18}" dominant-baseline="middle" fill="#98989f" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="11" font-weight="600" letter-spacing="1">DESCRIPTION</text>`,
		`<text x="${versionX + versionColumnWidth / 2}" y="${rowStart - 18}" text-anchor="middle" dominant-baseline="middle" fill="#98989f" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="11" font-weight="600" letter-spacing="1">VERSION</text>`,
		`<text x="${authorX + 12}" y="${rowStart - 18}" dominant-baseline="middle" fill="#98989f" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="11" font-weight="600" letter-spacing="1">AUTHORS</text>`,
		`<line x1="${catalogInset}" y1="${rowStart}" x2="${catalogWidth - catalogInset}" y2="${rowStart}" stroke="#2a2d33" stroke-width="1"/>`,
	];

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${catalogWidth}" height="${height}" viewBox="0 0 ${catalogWidth} ${height}" role="img" aria-labelledby="title description">`,
		`<title id="title">${title} plugin catalog</title>`,
		`<desc id="description">${plugins.length} Unbound plugins with their descriptions, versions, authors, and Discord icons.</desc>`,
		`<rect width="100%" height="100%" rx="24" fill="#121316" stroke="#2a2d33" stroke-width="2"/>`,
		`<text x="${catalogInset + 12}" y="47" dominant-baseline="middle" fill="#f5f5f7" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="27" font-weight="700">${title}</text>`,
		`<text x="${catalogInset + 12}" y="80" dominant-baseline="middle" fill="#98989f" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="14">${plugins.length} plugins in this workspace</text>`,
		...headerLines,
		...rowMarkup,
		`</svg>`,
		'',
	].join('\n');
}

function generate(): void {
	const plugins = readPluginManifests();
	const icons = readIconData(plugins);
	const catalog = renderCatalog(plugins, icons);
	const readme =
		'<p align="center"><img src="catalog.svg" alt="Unbound plugin catalog" width="100%"></p>\n';

	writeFileSync(catalogPath, catalog);
	writeFileSync(readmePath, readme);
}

generate();
