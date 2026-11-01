import {
	BADGE_IMAGE_MAX_BYTES,
	BADGE_IMAGE_MAX_LABEL,
	BADGE_IMAGE_TYPE,
	uploadBadgeImageResponseSchema,
} from '@unbound-app/contracts/sponsors';
import { z } from 'zod';

import { uploadBadgeImage } from '~/lib/sponsors/badges';
import { callerEndpoint } from '~/lib/api/endpoint';
import { ApiError } from '~/lib/api/errors';

async function readPng(request: Request): Promise<Blob> {
	if (request.headers.get('content-type')?.split(';')[0]?.trim() !== BADGE_IMAGE_TYPE) {
		throw new ApiError('badge_rejected', 'Badge images must be PNG files.');
	}

	// The full check runs on the bytes; this one refuses a declared oversized body before reading it.
	if (Number(request.headers.get('content-length')) > BADGE_IMAGE_MAX_BYTES) {
		throw new ApiError(
			'badge_rejected',
			`Badge images must be ${BADGE_IMAGE_MAX_LABEL} or smaller.`,
		);
	}

	return request.blob();
}

const uploadBadgeImageEndpoint = callerEndpoint(
	{
		body: z.instanceof(Blob),
		query: z.undefined(),
		response: uploadBadgeImageResponseSchema,
	},
	async ({ ctx, body, caller }) => {
		return uploadBadgeImage(ctx, caller.user.id, new Uint8Array(await body.arrayBuffer()));
	},
	{ readBody: readPng },
);

export default uploadBadgeImageEndpoint;
