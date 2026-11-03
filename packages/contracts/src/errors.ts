import { API_ERROR_CODES } from './api-error-codes';
import { Type, type StaticDecode } from './schema';

export { API_ERROR_CODES, isApiErrorCode } from './api-error-codes';

export const apiErrorCodeSchema = Type.Enum([...API_ERROR_CODES]);

/** The body of every non-2xx JSON response from `/api/v1/*`. */
export const apiErrorResponseSchema = Type.Object({
	error: Type.Object({
		code: apiErrorCodeSchema,
		message: Type.String(),
	}),
});

export type ApiErrorCode = StaticDecode<typeof apiErrorCodeSchema>;
export type ApiErrorResponse = StaticDecode<typeof apiErrorResponseSchema>;

export default { API_ERROR_CODES, apiErrorCodeSchema, apiErrorResponseSchema };
