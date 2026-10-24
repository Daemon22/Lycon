export function createIOC(input) {
  return { ...input };
}

export function classifyThreat(input) {
  return { ...input, classification: 'suspicious' };
}
