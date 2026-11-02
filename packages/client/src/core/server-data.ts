/**
 * @description Reads JSON the Unbound server validated before it sent or published it, so it is typed
 * without a check: the server never trusts the client, and the client trusts the server.
 * @template T The contract type the server wrote.
 * @param text The JSON text.
 * @returns The parsed value; throws on text that is not whole JSON, as after an interrupted write.
 */
export function readServerJson<T>(text: string): T {
	return JSON.parse(text);
}

export default readServerJson;
