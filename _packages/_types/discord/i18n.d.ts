import type SimpleMarkdown from 'simple-markdown';
import type { Primitive } from 'type-fest';
import type EventEmitter from 'events';


export type LocaleCallback = (locale?: string) => void;
export type ProxyCallback = (context?: i18nProviderContext) => ProxyConstructor;

export interface Events {
	locale: LocaleCallback[];
	newListener: (eventName?: 'locale') => void;
}

export interface i18nLocale {
	value: string;
	name: string;
	localizedName: string;
}

export interface i18nLanguage {
	name: string;
	englishName: string;
	code: string;
	postgresLang: string;
	enabled: boolean;
	enabledAPI?: boolean;
}

export interface i18nProviderContext {
	messages: i18nMessages;
	defaultMessages: i18nMessages;
	locale: string;
}

export interface i18nProvider {
	_context: i18nProviderContext;
	_createProxy: (context?: i18nProviderContext) => ProxyConstructor;
	_getParsedMessages: (
		context: i18nProviderContext,
		key?: string,
		proxyCallback?: ProxyCallback,
	) => i18nMessage;
	_parsedMessages: i18nMessages;
	refresh: (context: i18nProviderContext) => void;
	getMessages: () => i18nMessages;
}

export interface i18nFormats {
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
		formats: i18nFormats | NestedObject,
	): IntlMessageFormat;
	prototype: IntlMessageFormat;

	default: (
		message: string | ASTMessageFormatPattern,
		locales: string | string[],
		formats: i18nFormats | NestedObject,
	) => IntlMessageFormat;
	defaultLocale?: string;
	formats: i18nFormats;

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
		formats: i18nFormats | NestedObject,
		pluralFn: PluralFunction,
	) => Pattern[];
	_findPluralRuleFunction: (locale: string) => PluralFunction;
	_format: (pattern: Pattern[], values: IntlMessageValues) => ASTMessageFormatPattern;
	_mergeFormats: (
		defaults: i18nFormats | NestedObject,
		formats: NestedObject,
	) => i18nFormats | NestedObject;
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

export type i18nMessage = string & IntlMessageObject;
export type i18nMessages = Record<string, i18nMessage>;

export interface i18nModule extends EventEmitter {
	Messages: i18nMessages;
	loadPromise: Promise<void>;
	_chosenLocale: string | undefined;
	_events: Events;
	_eventsCount: number;
	_getMessages: <T extends string>(locale?: T) => T extends 'en-US' ? i18nMessages : Promise<i18nMessages>;
	_getParsedMessages: (
		context: i18nProviderContext,
		key?: string,
		createProxy?: ProxyCallback,
	) => i18nMessage;
	_handleNewListener: (eventName?: 'locale') => void;
	_languages: i18nLanguage[];
	_maxListeners: number | undefined;
	_provider: i18nProvider;
	_requestedLocale: string | undefined;

	getAvailableLocales: () => i18nLocale[];
	getDefaultLocale: () => string;
	getLanguages: () => i18nLanguage[];
	getLocale: () => string;
	getLocaleInfo: () => i18nLanguage;
	setLocale: (locale?: string) => void;
	setUpdateRules: (rules: SimpleMarkdown.ParserRules) => void;
	updateMessagesForExperiment: (
		locale: string,
		callback: (messages?: i18nMessages) => i18nMessages,
	) => void;
	_applyMessagesForLocale: (
		messages: i18nMessages,
		locale?: string,
		defaultMessages?: i18nMessages,
	) => void;
	_fetchMessages: <T extends string>(
		locale?: T,
	) => T extends 'en-US' ? i18nMessages | Error : Promise<i18nMessages>;
	_findMessages: (locale?: string) => i18nMessages | Error;
	_loadMessagesForLocale: (locale?: string) => Promise<void>;

	[key: PropertyKey]: any;
}