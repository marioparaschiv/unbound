import type { ReactElement } from 'react';

export type MediaItemElement = ReactElement<{
	item?: { node?: { image?: { fileSize?: number; uri?: string } } };
	size?: number;
}>;

export type FileSizeLookup = (uri: string) => number | undefined;

export type FileSizes = {
	lookup?: FileSizeLookup;
	release: () => void;
};

export type SizeBadge = {
	key: string;
	label: string;
	left: number;
};
