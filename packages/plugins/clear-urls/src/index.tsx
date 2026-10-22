import { metro, patcher } from '@unbound-app/api';

import { defaultRules } from '@clear-urls/defaultRules';

const unpatches: Array<() => void> = [];

const reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
const reHasRegExpChar = RegExp(reRegExpChar.source);

function escapeRegExp(str: string): string {
	return str && reHasRegExpChar.test(str) ? str.replace(reRegExpChar, '\\$&') : str || '';
}

let universalRules: Set<RegExp> = new Set();
let rulesByHost: Map<string, Set<RegExp>> = new Map();
let hostRules: Map<string, RegExp> = new Map();

function createRules(): void {
	universalRules = new Set();
	rulesByHost = new Map();
	hostRules = new Map();

	for (const rule of defaultRules) {
		const splitRule = rule.split('@');
		const paramRule = new RegExp(`^${escapeRegExp(splitRule[0]).replace(/\\\*/, '.+?')}$`);

		if (!splitRule[1]) {
			universalRules.add(paramRule);
			continue;
		}

		const hostRule = new RegExp(
			`^(www\\.)?${escapeRegExp(splitRule[1])
				.replace(/\\\./, '\\.')
				.replace(/^\\\*\\\./, '(.+?\\.)?')
				.replace(/\\\*/, '.+?')}$`,
		);
		const hostRuleIndex = hostRule.toString();

		hostRules.set(hostRuleIndex, hostRule);
		if (!rulesByHost.get(hostRuleIndex)) rulesByHost.set(hostRuleIndex, new Set());
		rulesByHost.get(hostRuleIndex)!.add(paramRule);
	}
}

function removeParam(rule: string | RegExp, param: string, parent: URLSearchParams): void {
	if (param === rule || (rule instanceof RegExp && rule.test(param))) {
		parent.delete(param);
	}
}

function replacer(match: string): string {
	let url: URL;
	try {
		url = new URL(match);
	} catch {
		return match;
	}

	if (url.searchParams.entries().next().done) return match;

	universalRules.forEach((rule) => {
		url.searchParams.forEach((_value, param, parent) => removeParam(rule, param, parent));
	});

	hostRules.forEach((regex, hostRuleName) => {
		if (!regex.test(url.hostname)) return;
		rulesByHost.get(hostRuleName)!.forEach((rule) => {
			url.searchParams.forEach((_value, param, parent) => removeParam(rule, param, parent));
		});
	});

	return url.toString();
}

function clean(content: string): string {
	if (!content || !/https?:\/\//.test(content)) return content;
	return content.replace(/(https?:\/\/[^\s<]+[^<.,:;"'>)|\]\s])/g, (match) => replacer(match));
}

function findMessageArg(args: unknown[]): { content?: string } | null {
	for (const arg of args) {
		if (
			arg &&
			typeof arg === 'object' &&
			typeof (arg as { content?: unknown }).content === 'string'
		) {
			return arg as { content?: string };
		}
	}
	return null;
}

function getMessageActions(): { sendMessage?: unknown; editMessage?: unknown } | null {
	return metro.findByProps('sendMessage', 'editMessage') as any;
}

export default {
	start() {
		createRules();

		const MessageActions = getMessageActions();
		if (!MessageActions) return;

		const clean_ = (ctx: { args: unknown[] }) => {
			const message = findMessageArg(ctx.args);
			if (message && typeof message.content === 'string') {
				message.content = clean(message.content);
			}
		};

		if (typeof MessageActions.sendMessage === 'function') {
			unpatches.push(patcher.before(MessageActions as any, 'sendMessage', clean_));
		}
		if (typeof MessageActions.editMessage === 'function') {
			unpatches.push(patcher.before(MessageActions as any, 'editMessage', clean_));
		}
	},

	stop() {
		while (unpatches.length) unpatches.pop()!();
	},
};
