import type { NativeJavaBridge, NativeJavaClassDescription } from '@unbound-app/api/native';
import { describe, expect, test } from 'bun:test';

import {
	draweeTextBuilder,
	DRAWEE_TEXT_VIEW,
	MESSAGE_VIEW,
	messageBindMethod,
	messageIdField,
} from './discord-views';
import { hasShapeConstructor, shapeField, shapeMethod } from './discord-shapes';

const MESSAGE = 'com.discord.chat.bridge.Message';
const STRING = 'java.lang.String';

type Members = Partial<Omit<NativeJavaClassDescription, 'name'>>;

type ClassDescriber = Pick<NativeJavaBridge, 'describe'>;

function method(name: string, parameters: string[], isStatic = false) {
	return { name, parameters, returnType: 'void', static: isStatic };
}

function field(name: string, type: string, isStatic = false) {
	return { name, type, static: isStatic };
}

function fakeJava(classes: Record<string, Members>): NativeJavaBridge {
	const describer: ClassDescriber = {
		describe(name: string): NativeJavaClassDescription {
			const members = classes[name];

			if (!members) {
				throw new Error(`${name} is missing`);
			}

			return {
				name,
				superclass: null,
				interfaces: [],
				constructors: [],
				methods: [],
				fields: [],
				...members,
			};
		},
	};

	return describer as NativeJavaBridge;
}

const stable = fakeJava({
	[MESSAGE_VIEW]: {
		methods: [
			method('configureAuthor', [MESSAGE, 'ChatEventHandler', 'ChainPart', 'MessageContext']),
			method('setMessage', [
				MESSAGE,
				'MessageContext',
				'ChatEventHandler',
				'ComponentProvider',
				'kotlin.jvm.functions.Function0',
				'boolean',
				'boolean',
			]),
			method('create', [MESSAGE, 'a', 'b', 'c', 'd', 'e', 'f', 'g'], true),
		],
		fields: [field('messageId', STRING), field('TAG', STRING, true)],
	},
	[DRAWEE_TEXT_VIEW]: {
		methods: [
			method('setDraweeSpanStringBuilder', [
				'com.facebook.drawee.span.DraweeSpanStringBuilder',
			]),
		],
	},
	'com.discord.span.utilities.spannable.BlockBackgroundSpan': {
		constructors: [['int', 'int', 'int', 'int', 'int', 'int', 'int']],
	},
	'com.discord.reactions.ReactionView': {
		fields: [
			field('binding', 'com.discord.reactions.databinding.ReactionViewBinding'),
			field('currentCount', 'java.lang.Integer'),
			field('currentEmojiId', STRING),
			field('currentShouldAnimate', 'java.lang.Boolean'),
		],
	},
});

const obfuscated = fakeJava({
	[MESSAGE_VIEW]: {
		methods: [
			method('b', [MESSAGE, 'd9.b', 'k9.v', 'ga.c']),
			method('f', [
				MESSAGE,
				'ga.c',
				'd9.b',
				'r9.c',
				'kotlin.jvm.functions.Function0',
				'boolean',
				'boolean',
			]),
		],
		fields: [field('x', STRING)],
	},
	[DRAWEE_TEXT_VIEW]: {
		methods: [method('setDraweeSpanStringBuilder', ['oj.c'])],
	},
	'lh.b': { constructors: [['int', 'int', 'int', 'int', 'int', 'int', 'int']] },
	'jh.a': { constructors: [['android.widget.TextView']] },
	'gg.b': {
		fields: [
			field('d', 'p.s3'),
			field('e', 'java.lang.Integer'),
			field('i', STRING),
			field('v', 'java.lang.Boolean'),
		],
	},
	'x9.a': { fields: [field('v', STRING), field('w', STRING)] },
});

describe('Discord shapes', () => {
	test('find the message binding method on named and obfuscated builds', () => {
		expect(messageBindMethod(stable).name).toBe('setMessage');
		expect(messageBindMethod(obfuscated)).toMatchObject({
			name: 'f',
			parameters: { length: 7 },
		});
	});

	test('find the message id field on both builds', () => {
		expect(messageIdField(stable)).toBe('messageId');
		expect(messageIdField(obfuscated)).toBe('x');
	});

	test('find the drawee span builder on both builds', () => {
		expect(draweeTextBuilder(stable)).toBe('com.facebook.drawee.span.DraweeSpanStringBuilder');
		expect(draweeTextBuilder(obfuscated)).toBe('oj.c');
	});

	test('recognise block background spans by their constructor', () => {
		expect(
			hasShapeConstructor(
				stable,
				'blockBackgroundSpan',
				'com.discord.span.utilities.spannable.BlockBackgroundSpan',
			),
		).toBe(true);
		expect(hasShapeConstructor(obfuscated, 'blockBackgroundSpan', 'lh.b')).toBe(true);
		expect(hasShapeConstructor(obfuscated, 'blockBackgroundSpan', 'jh.a')).toBe(false);
	});

	test("find a reaction view's emoji field on both builds", () => {
		expect(
			shapeField(stable, 'reactionEmoji', 'com.discord.reactions.ReactionView')?.name,
		).toBe('currentEmojiId');
		expect(shapeField(obfuscated, 'reactionEmoji', 'gg.b')?.name).toBe('i');
		expect(shapeField(obfuscated, 'reactionEmoji', 'x9.a')).toBeNull();
	});

	test('refuse lookups that several members fit', () => {
		const tied = fakeJava({
			[MESSAGE_VIEW]: {
				methods: [method('a', [MESSAGE, 'x']), method('b', [MESSAGE, 'y'])],
				fields: [field('id', STRING), field('author', STRING)],
			},
			[DRAWEE_TEXT_VIEW]: {
				methods: [
					method('setDraweeSpanStringBuilder', ['a.b']),
					method('setDraweeSpanStringBuilder', ['c.d']),
				],
			},
		});

		expect(shapeMethod(tied, 'messageBind')).toBeNull();
		expect(() => messageBindMethod(tied)).toThrow('no single MessageView method');
		expect(() => messageIdField(tied)).toThrow('no single text field');
		expect(() => draweeTextBuilder(tied)).toThrow('no single drawee span text builder');
	});

	test('reject a shape used as the wrong member or without a class', () => {
		expect(() => shapeField(stable, 'messageBind')).toThrow('describes a method, not a field');
		expect(() => shapeField(stable, 'reactionEmoji')).toThrow('needs the class to look in');
	});
});
