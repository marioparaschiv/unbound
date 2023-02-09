function isEmpty(object: Record<any, any>) {
  for (const _ in object) {
    return false;
  }

  return true;
}

export default isEmpty;