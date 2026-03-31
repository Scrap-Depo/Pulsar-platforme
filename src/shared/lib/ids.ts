export function createId(prefix = 'id') {
  return `${prefix}-${Date.now()}`;
}
