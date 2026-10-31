import type { RuleTester } from 'oxlint/plugins-dev';

type AnyRule = Parameters<RuleTester['run']>[1];

type OnceRule = { createOnce: unknown };

export type Rule = Exclude<AnyRule, OnceRule>;

export type Plugin = {
	meta: { name: string };
	rules: Record<string, Rule>;
};

export type Context = Parameters<Rule['create']>[0];

type Visitor = ReturnType<Rule['create']>;

export type NodeOf<K extends keyof Visitor> = Parameters<NonNullable<Visitor[K]>>[0];
