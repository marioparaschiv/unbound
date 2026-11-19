import { describe, expect, test } from 'bun:test';

import { romanizeHangul } from '~/lib/revised-romanization';

const CASES: [hangul: string, latin: string][] = [
	['안녕하세요', 'annyeonghaseyo'],
	['감사합니다', 'gamsahamnida'],
	['한국어', 'hangugeo'],
	['대한민국', 'daehanminguk'],
	['서울', 'seoul'],
	['부산', 'busan'],
	['신라', 'silla'],
	['종로', 'jongno'],
	['설날', 'seollal'],
	['왕십리', 'wangsimni'],
	['국물', 'gungmul'],
	['백마', 'baengma'],
	['좋아', 'joa'],
	['좋고', 'joko'],
	['같이', 'gachi'],
	['굳이', 'guji'],
	['볶음밥', 'bokkeumbap'],
	['닭', 'dak'],
	['앉아', 'anja'],
	['맑음', 'malgeum'],
	['라면', 'ramyeon'],
];

describe('Revised Romanization', () => {
	test.each(CASES)('%s → %s', (hangul, latin) => {
		expect(romanizeHangul(hangul)).toBe(latin);
	});

	test('keeps spaces, punctuation and other scripts', () => {
		expect(romanizeHangul('서울 가자! ok')).toBe('seoul gaja! ok');
	});
});
