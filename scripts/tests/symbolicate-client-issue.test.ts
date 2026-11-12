import { describe, expect, test } from 'bun:test';

import { clientSymbolsComment, parseClientCrash } from '../symbolicate-client-issue';

const body = [
	'### Environment',
	'',
	'- **Unbound:** v3.1.0 (`fdbe58da2`), loader 1.3.0 (`Unbound.dylib`)',
	'- **Runtime:** React 19.2.3, React Native 0.86.0, Hermes 250829098.0.15 (HBC 96)',
	'',
	'### Error',
	'',
	'TypeError: undefined is not a function',
	'    at render (address at unbound:1:204811)',
	'',
	'### What were you doing when it crashed?',
	'',
	'Opening a DM',
].join('\n');

describe('client crash issues', () => {
	test('finds the commit, bytecode version and error stack', () => {
		expect(parseClientCrash(body)).toEqual({
			commit: 'fdbe58da2',
			bytecode: '96',
			error: 'TypeError: undefined is not a function\n    at render (address at unbound:1:204811)',
		});
	});

	test('skips issues without client frames or already answered', () => {
		expect(
			parseClientCrash(body.replace('address at unbound:1:204811', ':1:7042')),
		).toBeUndefined();
		expect(parseClientCrash(`${body}\n${clientSymbolsComment('x', 'y')}`)).toBeUndefined();
	});

	test('quotes the mapped stack', () => {
		expect(clientSymbolsComment('fdbe58da2', 'at render (src/ui/x.tsx:4:2)')).toContain(
			'`fdbe58da2`:\n\n```\nat render (src/ui/x.tsx:4:2)\n```',
		);
	});
});
