import { BuiltIn } from '@typings/core/builtins';
import { createPatcher } from '@patcher';

const Patcher = createPatcher('badges');

export const data: BuiltIn['data'] = {
  id: 'misc.badges',
  default: true
};

export function initialize() {

}

export function shutdown() {

}
