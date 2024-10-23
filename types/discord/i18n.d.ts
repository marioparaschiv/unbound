import type SimpleMarkdown from 'simple-markdown';
import type { Primitive } from 'type-fest';
import type EventEmitter from 'events';

export type LocaleCallback = (locale?: string) => void;
export type ProxyCallback = (context?: ProviderContext) => ProxyConstructor;

export interface Events {
	locale: LocaleCallback[];
	newListener: (eventName?: 'locale') => void;
}

export interface Locale {
	value: string;
	name: string;
	localizedName: string;
}

export interface Language {
	name: string;
	englishName: string;
	code: string;
	postgresLang: string;
	enabled: boolean;
	enabledAPI?: boolean;
}

export interface ProviderContext {
	messages: Messages;
	defaultMessages: Messages;
	locale: string;
}

export interface Provider {
	_context: ProviderContext;
	_createProxy: (context?: ProviderContext) => ProxyConstructor;
	_getParsedMessages: (
		context: ProviderContext,
		key?: string,
		proxyCallback?: ProxyCallback,
	) => Message;
	_parsedMessages: Messages;
	refresh: (context: ProviderContext) => void;
	getMessages: () => Messages;
}

export interface Formats {
	number: Record<'currency' | 'percent', Intl.NumberFormatOptions>;
	date: Record<'short' | 'medium' | 'long' | 'full', Intl.DateTimeFormatOptions>;
	time: Record<'short' | 'medium' | 'long' | 'full', Intl.DateTimeFormatOptions>;
}

export interface ASTSimpleFormat {
	type: 'numberFormat' | 'dateFormat' | 'timeFormat';
	style: string;
}

export interface ASTPluralFormat extends ASTPluralStyle {
	ordinal: false;
}

export interface ASTSelectFormat {
	type: 'selectFormat';
	options: ASTOptionalFormatPattern[];
}

export interface ASTSelectOrdinalFormat extends ASTPluralStyle {
	ordinal: true;
}

export interface ASTOptionalFormatPattern {
	type: 'optionalFormatPattern';
	selector: string;
	value: ASTMessageFormatPattern;
}

export interface ASTPluralStyle {
	type: 'pluralFormat';
	offset: number;
	options: ASTOptionalFormatPattern[];
}

export type ASTElementFormat =
	| ASTSimpleFormat
	| ASTPluralFormat
	| ASTSelectOrdinalFormat
	| ASTSelectFormat;

export interface ASTArgumentElement {
	type: 'argumentElement';
	id: string;
	format?: ASTElementFormat;
}

export interface ASTMessageTextElement {
	type: 'messageTextElement';
	value: string;
}

export type ASTElement = ASTMessageTextElement | ASTArgumentElement;

export interface ASTMessageFormatPattern {
	type: 'messageFormatPattern';
	elements: ASTElement[];
}

export interface LocaleData {
	locale: string;
	parentLocale?: string;
	pluralRuleFunction: PluralFunction | undefined;
}

export interface ResolvedOptions {
	locale?: string;
}

export type FormatXMLElementFn<T, R = string | T | Array<string | T>> = (parts: Array<string | T>) => R;
export type IntlMessageValues = Record<string, Primitive | FormatXMLElementFn<string, string>>;

export interface IntlMessageFormatConstructor {
	new(
		message: string | ASTMessageFormatPattern,
		locales: string | string[],
		formats: Formats | NestedObject,
	): IntlMessageFormat;
	prototype: IntlMessageFormat;

	default: (
		message: string | ASTMessageFormatPattern,
		locales: string | string[],
		formats: Formats | NestedObject,
	) => IntlMessageFormat;
	defaultLocale?: string;
	formats: Formats;

	/* eslint-disable @typescript-eslint/naming-convention */
	__addLocaleData: (data: LocaleData) => void;
	__localeData__: () => Record<string, LocaleData>;
	__parse: (message: string) => ASTMessageFormatPattern;
	/* eslint-enable @typescript-eslint/naming-convention */
}

export interface NestedObject {
	[key: string]: string | NestedObject;
}

export type PluralFunction = (value?: number, useOrdinal?: boolean) => string;
export type Pattern = string | ASTPluralFormat | ASTSelectFormat;

export interface IntlMessageFormat {
	constructor: IntlMessageFormatConstructor;

	resolvedOptions: () => ResolvedOptions;
	_compilePattern: (
		ast: ASTMessageFormatPattern,
		locales: string | string[],
		formats: Formats | NestedObject,
		pluralFn: PluralFunction,
	) => Pattern[];
	_findPluralRuleFunction: (locale: string) => PluralFunction;
	_format: (pattern: Pattern[], values: IntlMessageValues) => ASTMessageFormatPattern;
	_mergeFormats: (
		defaults: Formats | NestedObject,
		formats: NestedObject,
	) => Formats | NestedObject;
	_resolveLocale: (locales: string | string[]) => string;

	format: (values?: IntlMessageValues) => string;
	_locale: string;
}

export interface IntlMessageObject {
	hasMarkdown: boolean;
	intlMessage: IntlMessageFormat;
	message: string;
	astFormat: (values?: string | IntlMessageValues) => NestedObject;
	format: (values?: IntlMessageValues) => string;
	getContext: (values?: string | IntlMessageValues) => Record<string, Primitive>;
	plainFormat: (values?: string | IntlMessageValues) => string;
}

export type Message = string & IntlMessageObject;
export type Messages = Record<string, Message>;

export interface i18nModule extends EventEmitter {
	Messages: Messages;
	loadPromise: Promise<void>;
	_chosenLocale: string | undefined;
	_events: Events;
	_eventsCount: number;
	_getMessages: <T extends string>(locale?: T) => T extends 'en-US' ? Messages : Promise<Messages>;
	_getParsedMessages: (
		context: ProviderContext,
		key?: string,
		createProxy?: ProxyCallback,
	) => Message;
	_handleNewListener: (eventName?: 'locale') => void;
	_languages: Language[];
	_maxListeners: number | undefined;
	_provider: Provider;
	_requestedLocale: string | undefined;

	getAvailableLocales: () => Locale[];
	getDefaultLocale: () => string;
	getLanguages: () => Language[];
	getLocale: () => string;
	getLocaleInfo: () => Language;
	setLocale: (locale?: string) => void;
	setUpdateRules: (rules: SimpleMarkdown.ParserRules) => void;
	updateMessagesForExperiment: (
		locale: string,
		callback: (messages?: Messages) => Messages,
	) => void;
	_applyMessagesForLocale: (
		messages: Messages,
		locale?: string,
		defaultMessages?: Messages,
	) => void;
	_fetchMessages: <T extends string>(
		locale?: T,
	) => T extends 'en-US' ? Messages | Error : Promise<Messages>;
	_findMessages: (locale?: string) => Messages | Error;
	_loadMessagesForLocale: (locale?: string) => Promise<void>;

	[key: PropertyKey]: any;
}