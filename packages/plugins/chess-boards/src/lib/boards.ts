import type { EmbedImage } from '@unbound-plugins/shared/messages/image-embed';

type Board = EmbedImage;

const RANK = '[pnbrqkPNBRQK1-8]{1,8}';
const FEN = new RegExp(
	`(?<![\\w/])((?:${RANK}/){7}${RANK})(?:\\s+([wb])(?:\\s+(-|[KQkq]{1,4})(?:\\s+(-|[a-h][36])(?:\\s+(\\d+)\\s+(\\d+))?)?)?)?(?![\\w/])`,
	'g',
);
const GAME =
	/https?:\/\/(?:www\.)?lichess\.org\/([a-zA-Z0-9]{8})(?:[a-zA-Z0-9]{4})?(?=$|[/#?\s>)\]])/g;
const SITE_PAGE = /^[a-z]+$/;
const MAX_BOARDS = 3;
const SQUARES = 8;

function rankWidth(rank: string): number {
	return [...rank].reduce((width, square) => width + (Number(square) || 1), 0);
}

function isPlacement(placement: string): boolean {
	const ranks = placement.split('/');

	return (
		ranks.every((rank) => rankWidth(rank) === SQUARES) &&
		ranks
			.join('')
			.split('')
			.filter((square) => square === 'k').length === 1 &&
		ranks
			.join('')
			.split('')
			.filter((square) => square === 'K').length === 1
	);
}

function positionBoard(match: RegExpMatchArray): Board | undefined {
	const [, placement, side = 'w', castling = '-', passant = '-', halfmove = '0', fullmove = '1'] =
		match;

	if (!isPlacement(placement)) return undefined;

	const fen = [placement, side, castling, passant, halfmove, fullmove].join(' ');
	const color = side === 'b' ? 'black' : 'white';

	return {
		url: `https://lichess1.org/export/fen.gif?fen=${encodeURIComponent(fen)}&color=${color}`,
		width: 720,
		height: 720,
	};
}

function gameBoard(match: RegExpMatchArray): Board | undefined {
	if (SITE_PAGE.test(match[1])) return undefined;

	return { url: `https://lichess.org/game/export/gif/${match[1]}.gif`, width: 720, height: 840 };
}

/**
 * @description Finds the chess positions written as FEN and the lichess game links in a message, as board images.
 * @param content The message content.
 * @returns Up to three boards, each once, in the order they appear.
 */
export function findBoards(content: string): Board[] {
	const found = [
		...[...content.matchAll(FEN)].map((match) => ({
			at: match.index,
			board: positionBoard(match),
		})),
		...[...content.matchAll(GAME)].map((match) => ({
			at: match.index,
			board: gameBoard(match),
		})),
	].sort((first, second) => first.at - second.at);
	const boards = new Map<string, Board>();

	for (const { board } of found) {
		if (board) boards.set(board.url, board);
	}

	return [...boards.values()].slice(0, MAX_BOARDS);
}
