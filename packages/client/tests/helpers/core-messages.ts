import enUS from '@i18n/en-US.json';
import { mock } from 'bun:test';

// Core i18n reads Discord's modules off `window` while it loads; commands only need its en-US messages.
// Import this helper before anything that reaches `~/commands/api`.
mock.module('~/i18n/api', () => ({
	messages: enUS,
	format: (key: string) => Reflect.get(enUS, key) ?? key,
}));
