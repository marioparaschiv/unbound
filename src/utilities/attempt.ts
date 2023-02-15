/**
 * @description Attempts calling a function and bails if it fails
 * @param {function} func - The function to debounce
 * @return {void}
 */

function attempt(func: Function) {
  try {
    func();
  } catch {
    // Bail.
  }
};

export default attempt;