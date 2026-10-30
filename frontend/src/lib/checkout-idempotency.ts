function stableStringify(value: any): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  const valueType = typeof value;
  if (valueType === 'number' || valueType === 'boolean') {
    return JSON.stringify(value);
  }

  if (valueType === 'string') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (valueType === 'object') {
    const keys = Object.keys(value).sort();
    const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(String(value));
}

function hashString(input: string): string {
  let hash = 2166136261;

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return `chk_${(hash >>> 0).toString(36)}`;
}

export function createCheckoutSessionId(payload: any): string {
  return hashString(stableStringify(payload));
}