import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { LANGUAGE_CATALOG_URL } from '../src/catalog';

const DEVICON_COMMIT = '7330accdbc47e2dc0c19789a48533c4a3c50fe58';
const output = resolve(import.meta.dir, '../src/devicons.json');

type Language = { devicon?: string; name: string };

const response = await fetch(LANGUAGE_CATALOG_URL);
if (!response.ok) throw new Error(`Language catalog returned ${response.status}`);
const catalog = (await response.json()) as Language[];
const languages: Record<string, string> = {};
const images: Record<string, string> = {};

for (const language of catalog) {
	if (language.devicon) languages[language.name] = language.devicon;
}

const iconNames = [...new Set(Object.values(languages))].sort();
for (const iconName of iconNames) {
	const family = iconName.replace(/-(plain|original|line)(?:-wordmark)?$/, '');
	const candidates = [
		iconName,
		iconName.replace('-plain', '-original'),
		iconName.replace('-line', '-original'),
		`${iconName}-original`,
	];
	try {
		let svg: string | null = null;
		for (const candidate of candidates) {
			const url = `https://raw.githubusercontent.com/devicons/devicon/${DEVICON_COMMIT}/icons/${family}/${candidate}.svg`;
			const iconResponse = await fetch(url);
			if (iconResponse.ok) {
				svg = await iconResponse.text();
				break;
			}
		}
		if (!svg) throw new Error('Icon asset is unavailable');
		const png = execFileSync(
			'resvg',
			['--resources-dir', '/tmp', '-w', '32', '-h', '32', '-', '-c'],
			{
				input: svg,
				maxBuffer: 1024 * 1024,
			},
		);
		images[iconName] = png.toString('base64');
	} catch (error) {
		console.warn(`Could not rasterize ${iconName}:`, error);
	}
}

await Bun.write(output, `${JSON.stringify({ languages, images }, null, '\t')}\n`);
console.log(`Generated ${Object.keys(images).length} icons from ${iconNames.length} names.`);
