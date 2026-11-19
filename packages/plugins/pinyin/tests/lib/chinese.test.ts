import { describe, expect, test } from 'bun:test';

import { needsPinyin, pinyinLine } from '~/lib/chinese';

describe('chinese', () => {
	test('shows pinyin for Chinese, not for Japanese or Latin text', () => {
		expect(needsPinyin('我爱你')).toBe(true);
		expect(needsPinyin('今天 ok')).toBe(true);
		expect(needsPinyin('東京に行きます')).toBe(false);
		expect(needsPinyin('hello')).toBe(false);
	});

	test('tidies the spacing of the reading', () => {
		expect(pinyinLine(' wǒ  ài   nǐ ')).toBe('wǒ ài nǐ');
	});

	test('writes Chinese punctuation the Latin way', () => {
		expect(pinyinLine('wǒ ài nǐ， zhōng guó。')).toBe('wǒ ài nǐ, zhōng guó.');
		expect(pinyinLine('nǐ hǎo ma ？hǎo ！')).toBe('nǐ hǎo ma? hǎo!');
		expect(pinyinLine('tā shuō：「nǐ hǎo」')).toBe('tā shuō: “nǐ hǎo”');
		expect(pinyinLine('wǒ （ xiǎo míng ） lái le')).toBe('wǒ (xiǎo míng) lái le');
		expect(pinyinLine('dì 3.5 zhāng')).toBe('dì 3.5 zhāng');
	});
});
