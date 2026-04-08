export const STORY_CREDIT_COSTS = {
  short: 50,
  medium: 100,
  long: 175,
} as const;

export type StoryLength = keyof typeof STORY_CREDIT_COSTS;

export function hasEnoughCredits(balance: number, length: StoryLength): boolean {
  return balance >= STORY_CREDIT_COSTS[length];
}

export function creditsToDisplayPrice(credits: number): string {
  return `$${(credits * 0.01).toFixed(2)}`;
}

export const CREDIT_PACKS = [
  { id: 'starter', credits: 100, price: 1.0, label: 'Starter' },
  { id: 'basic', credits: 300, price: 2.5, label: 'Basic' },
  { id: 'popular', credits: 600, price: 4.5, label: 'Popular' },
  { id: 'value', credits: 1500, price: 9.99, label: 'Value' },
  { id: 'mega', credits: 3500, price: 19.99, label: 'Mega' },
] as const;
