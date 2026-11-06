// Trims Discord's colours to the ramps and the tokens the theme maker uses.
// Usage: bun scripts/theme-maker-data.ts <semantic-definitions.json> <raw-colors.json>
import { Type, parse } from '@unbound-app/contracts/schema';

import { ADVANCED_TOKENS } from '../src/lib/theme-maker/advanced-overrides';
import { getRampFamily, type ThemeBase } from '../src/lib/theme-maker/ramp';
import { SCENE_TOKENS } from '../src/lib/theme-maker/scene-tokens';

const OUTPUT = new URL('../src/lib/theme-maker/discord-colors.json', import.meta.url);

const definitionsSchema = Type.Record(Type.String(), Type.Record(Type.String(), Type.String()));
const rawsSchema = Type.Record(Type.String(), Type.String());

const [definitionsPath, rawsPath] = process.argv.slice(2);

if (!definitionsPath || !rawsPath) {
	throw new Error('Usage: bun scripts/theme-maker-data.ts <definitions.json> <raws.json>');
}

const definitions = parse(definitionsSchema, await Bun.file(definitionsPath).json());
const raws = parse(rawsSchema, await Bun.file(rawsPath).json());
// Discord's definitions key each base by its internal name.
const BASE_KEYS: Record<ThemeBase, string> = {
	dark: 'ASH',
	darker: 'DARK',
	midnight: 'ONYX',
	light: 'LIGHT',
};
const tokens: Record<string, Record<string, string>> = {};
const names = new Set<string>([...Object.values(SCENE_TOKENS), ...ADVANCED_TOKENS]);

for (const [base, key] of Object.entries(BASE_KEYS)) {
	const resolved: Record<string, string> = {};

	for (const token of names) {
		const value = definitions[token]?.[key];

		if (!value) {
			throw new Error(`Failed to find the ${base} definition of ${token}`);
		}

		resolved[token] = value;
	}

	tokens[base] = resolved;
}

const used = new Set(
	Object.values(tokens).flatMap((resolved) =>
		Object.values(resolved).map((value) => value.split('@')[0] ?? value),
	),
);
const raw: Record<string, string> = {};

for (const [name, hex] of Object.entries(raws)) {
	if (getRampFamily(name) || used.has(name)) {
		raw[name] = hex;
	}
}

for (const name of used) {
	if (!raw[name]) {
		throw new Error(`Failed to find the raw colour ${name}`);
	}
}

await Bun.write(OUTPUT, JSON.stringify({ tokens, raw }, null, '\t') + '\n');

console.log(
	`Wrote ${names.size} tokens for ${Object.keys(tokens).length} bases and ${Object.keys(raw).length} raws.`,
);
