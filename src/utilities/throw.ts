/**
 * @description Throws an error, to be used in ternary expressions
 * @param {string?} message - The message to be thrown 
 * @throws {Error} Throws an error with the specified message
 */
export default function throwError<T>(message = "Error"): T {
    throw new Error(message);
}
