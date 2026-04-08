// Client-side safety helpers — not a replacement for the server SafetyService.
// Used to validate free-text input length before sending to the backend.

const MAX_FREE_TEXT_WORDS = 3;

export function truncateFreeTextInput(input: string): string {
  const words = input.trim().split(/\s+/);
  return words.slice(0, MAX_FREE_TEXT_WORDS).join(' ');
}

export function isFreeTextInputValid(input: string): boolean {
  const words = input.trim().split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= MAX_FREE_TEXT_WORDS;
}
