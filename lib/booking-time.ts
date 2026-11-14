const COLOMBO_OFFSET_MS = 330 * 60_000;

export function colomboInput(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() + COLOMBO_OFFSET_MS).toISOString().slice(0, 16);
}

export function colomboInputToInstant(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error('Enter a valid date and time in Sri Lanka time.');
  }
  const date = new Date(`${value}:00+05:30`);
  if (!Number.isFinite(date.getTime()) || colomboInput(date.toISOString()) !== value) {
    throw new Error('Enter a valid date and time in Sri Lanka time.');
  }
  return date.toISOString();
}
