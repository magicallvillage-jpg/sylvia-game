export type FoodCat = 'fruits' | 'meals' | 'sweets' | 'drinks' | 'fish' | 'veggies';
export type Taste = 'love' | 'ok' | 'dislike';

export interface Food {
  id: string;
  emoji: string;
  cat: FoodCat;
  hunger: number; // hunger restored
  happy: number; // happiness change
  xp: number;
  unlock: number; // level required
  taste: Taste;
  drink?: boolean;
}

export const FOOD_CATS: { id: FoodCat; emoji: string }[] = [
  { id: 'fruits', emoji: '🍎' },
  { id: 'meals', emoji: '🍙' },
  { id: 'sweets', emoji: '🍰' },
  { id: 'drinks', emoji: '🥛' },
  { id: 'fish', emoji: '🐟' },
  { id: 'veggies', emoji: '🥕' },
];

// To add a food: add a row here + a `food.<id>` string in i18n (en + fa). That's it.
export const FOODS: Food[] = [
  { id: 'apple', emoji: '🍎', cat: 'fruits', hunger: 12, happy: 2, xp: 4, unlock: 1, taste: 'ok' },
  { id: 'banana', emoji: '🍌', cat: 'fruits', hunger: 14, happy: 2, xp: 4, unlock: 1, taste: 'ok' },
  { id: 'strawberry', emoji: '🍓', cat: 'fruits', hunger: 10, happy: 5, xp: 5, unlock: 2, taste: 'love' },
  { id: 'watermelon', emoji: '🍉', cat: 'fruits', hunger: 16, happy: 3, xp: 6, unlock: 3, taste: 'ok' },

  { id: 'riceball', emoji: '🍙', cat: 'meals', hunger: 26, happy: 2, xp: 7, unlock: 1, taste: 'ok' },
  { id: 'noodles', emoji: '🍜', cat: 'meals', hunger: 34, happy: 3, xp: 9, unlock: 2, taste: 'ok' },
  { id: 'sandwich', emoji: '🥪', cat: 'meals', hunger: 30, happy: 2, xp: 8, unlock: 4, taste: 'ok' },
  { id: 'pizza', emoji: '🍕', cat: 'meals', hunger: 38, happy: 5, xp: 11, unlock: 8, taste: 'love' },

  { id: 'cookie', emoji: '🍪', cat: 'sweets', hunger: 8, happy: 6, xp: 5, unlock: 1, taste: 'ok' },
  { id: 'cake', emoji: '🍰', cat: 'sweets', hunger: 14, happy: 9, xp: 8, unlock: 3, taste: 'love' },
  { id: 'donut', emoji: '🍩', cat: 'sweets', hunger: 12, happy: 8, xp: 7, unlock: 6, taste: 'ok' },
  { id: 'icecream', emoji: '🍦', cat: 'sweets', hunger: 10, happy: 10, xp: 8, unlock: 9, taste: 'ok' },

  { id: 'milk', emoji: '🥛', cat: 'drinks', hunger: 10, happy: 4, xp: 4, unlock: 1, taste: 'love', drink: true },
  { id: 'juice', emoji: '🧃', cat: 'drinks', hunger: 8, happy: 4, xp: 4, unlock: 2, taste: 'ok', drink: true },
  { id: 'tea', emoji: '🍵', cat: 'drinks', hunger: 6, happy: 3, xp: 4, unlock: 5, taste: 'ok', drink: true },
  { id: 'smoothie', emoji: '🥤', cat: 'drinks', hunger: 14, happy: 5, xp: 6, unlock: 8, taste: 'ok', drink: true },

  { id: 'fish', emoji: '🐟', cat: 'fish', hunger: 24, happy: 9, xp: 9, unlock: 1, taste: 'love' },
  { id: 'sushi', emoji: '🍣', cat: 'fish', hunger: 26, happy: 8, xp: 10, unlock: 4, taste: 'love' },
  { id: 'shrimp', emoji: '🍤', cat: 'fish', hunger: 22, happy: 7, xp: 9, unlock: 6, taste: 'ok' },
  { id: 'sardine', emoji: '🥫', cat: 'fish', hunger: 20, happy: 6, xp: 8, unlock: 7, taste: 'ok' },

  { id: 'carrot', emoji: '🥕', cat: 'veggies', hunger: 12, happy: 1, xp: 4, unlock: 1, taste: 'ok' },
  { id: 'broccoli', emoji: '🥦', cat: 'veggies', hunger: 14, happy: -3, xp: 5, unlock: 2, taste: 'dislike' },
  { id: 'corn', emoji: '🌽', cat: 'veggies', hunger: 16, happy: 2, xp: 5, unlock: 3, taste: 'ok' },
  { id: 'tomato', emoji: '🍅', cat: 'veggies', hunger: 10, happy: 2, xp: 4, unlock: 4, taste: 'ok' },
];

export const foodById = (id: string): Food | undefined => FOODS.find((f) => f.id === id);
