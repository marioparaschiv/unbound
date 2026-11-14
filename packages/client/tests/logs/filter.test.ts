import type { UnboundLogEntry, UnboundLogSource } from '@unbound-app/types';
import { describe, expect, test } from 'bun:test';

import { filterLogEntries, type LogFilter } from '~/logs/filter';

const entry = (src: UnboundLogSource, msg: string, scope: string[] = []): UnboundLogEntry => ({
	t: 0,
	src,
	lvl: 'info',
	scope,
	msg,
});

const entries = [
	entry('unbound', 'Loaded plugins', ['Plugins', 'Manager']),
	entry('js', 'Discord ready'),
	entry('react-native', 'Running "Discord"'),
	entry('native', 'nw_connection failed'),
];

const shown = (filter: Partial<LogFilter>) =>
	filterLogEntries(entries, { segment: 'all', unboundOnly: false, search: '', ...filter }).map(
		(line) => line.src,
	);

describe('filtering log entries', () => {
	test('each segment shows its sources, JS including Unbound', () => {
		expect(shown({})).toEqual(['unbound', 'js', 'react-native', 'native']);
		expect(shown({ segment: 'js' })).toEqual(['unbound', 'js']);
		expect(shown({ segment: 'react-native' })).toEqual(['react-native']);
		expect(shown({ segment: 'native' })).toEqual(['native']);
	});

	test('Unbound only narrows to Unbound lines', () => {
		expect(shown({ unboundOnly: true })).toEqual(['unbound']);
		expect(shown({ segment: 'native', unboundOnly: true })).toEqual([]);
	});

	test('search matches the message or scope, ignoring case', () => {
		expect(shown({ search: 'READY' })).toEqual(['js']);
		expect(shown({ search: 'manager' })).toEqual(['unbound']);
		expect(shown({ search: '  ' })).toHaveLength(4);
	});
});
