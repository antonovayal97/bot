import { api } from './config';

let textsCache: Record<string, string> = {};

export function replacePlaceholders(template: string, placeholders?: Record<string, string | number>): string {
  if (!placeholders) return template;
  let result = template;
  for (const [k, v] of Object.entries(placeholders)) {
    result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v ?? ''));
  }
  return result;
}

export function getText(key: string, placeholders?: Record<string, string | number>): string {
  const raw = textsCache[key] ?? key;
  return replacePlaceholders(raw, placeholders);
}

export async function loadTexts(): Promise<void> {
  try {
    const res = await api('/texts');
    if (res.ok) {
      const data = (await res.json()) as Record<string, string>;
      textsCache = data ?? {};
    }
  } catch {
    // keep existing cache or empty
  }
}
