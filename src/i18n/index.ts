import { useCallback } from 'react';
import { useGameStore, type Lang } from '../store/gameStore';

type Dict = Record<string, string>;

const en: Dict = {
  'need.hunger': 'Hunger', 'need.hygiene': 'Hygiene', 'need.bladder': 'Bathroom',
  'need.energy': 'Energy', 'need.happiness': 'Happiness', 'need.affection': 'Love',
  'room.living': 'Living room', 'room.kitchen': 'Kitchen', 'room.bathroom': 'Bathroom', 'room.bedroom': 'Bedroom',
  'cat.fruits': 'Fruits', 'cat.meals': 'Meals', 'cat.sweets': 'Sweets', 'cat.drinks': 'Drinks', 'cat.fish': 'Fish', 'cat.veggies': 'Veggies',
  'food.apple': 'Apple', 'food.banana': 'Banana', 'food.strawberry': 'Strawberry', 'food.watermelon': 'Watermelon',
  'food.riceball': 'Rice ball', 'food.noodles': 'Noodles', 'food.sandwich': 'Sandwich', 'food.pizza': 'Pizza',
  'food.cookie': 'Cookie', 'food.cake': 'Cake', 'food.donut': 'Donut', 'food.icecream': 'Ice cream',
  'food.milk': 'Milk', 'food.juice': 'Juice', 'food.tea': 'Tea', 'food.smoothie': 'Smoothie',
  'food.fish': 'Fish', 'food.sushi': 'Sushi', 'food.shrimp': 'Shrimp', 'food.sardine': 'Sardines',
  'food.carrot': 'Carrot', 'food.broccoli': 'Broccoli', 'food.corn': 'Corn', 'food.tomato': 'Tomato',
  'act.fridge': 'Fridge', 'act.bath': 'Bath', 'act.toilet': 'Toilet', 'act.sleep': 'Sleep', 'act.wake': 'Wake up',
  'act.hug': 'Hug', 'act.play': 'Play', 'act.back': 'Done',
  'food.title': 'What shall {name} eat?', 'food.hint': 'Tap a food, or drag it to her mouth.', 'food.locked': 'Level {n}',
  'bath.sponge': 'Soap', 'bath.shower': 'Shower', 'bath.towel': 'Towel',
  'bath.hint.sponge': 'Rub the soap over {name}!', 'bath.hint.shower': 'Rinse the foam away.', 'bath.hint.towel': 'Dry her fluffy fur.',
  'toast.love': 'Yummy! Her favourite!', 'toast.yum': 'Nom nom~', 'toast.yuck': 'Bleh! She does not like that.',
  'toast.full': 'Burp! She is stuffed.', 'toast.sleeping': 'Shh… she is sleeping.', 'toast.locked': 'Unlocks at level {n}.',
  'toast.clean': 'Squeaky clean and fluffy!', 'toast.toiletDone': 'Ahh, much better!', 'toast.notNeeded': 'She does not need the bathroom yet.',
  'toast.busy': 'One moment…', 'toast.grumpy': 'Grumpy… she needed more sleep.', 'toast.rested': 'Good morning!',
  'toast.imported': 'Save imported.', 'toast.importFail': 'That file is not a valid Sylvia save.',
  'toast.playDone': 'That was fun!', 'toast.tooTired': 'She is too tired to play.',
  'want.food': 'Hungry!', 'want.toilet': 'Bathroom!', 'want.bed': 'Sleepy…', 'want.bath': 'Dirty…', 'want.heart': 'Cuddles?',
  'welcome.title': 'Welcome back!', 'welcome.body': '{name} missed you. You were away for {time}.',
  'welcome.changes': 'While you were gone', 'welcome.continue': 'Continue',
  'time.min': '{n} min', 'time.hour': '{n} h', 'time.hourmin': '{h} h {m} min',
  'levelup.title': 'Level {n}!', 'levelup.body': '{name} grew stronger. Reward: {coins} coins.', 'levelup.unlocks': 'New foods:',
  'name.title': 'Name your kitten', 'name.body': 'Every kitten needs a name.', 'name.placeholder': 'Sylvia', 'name.start': 'Start',
  'settings.title': 'Settings', 'settings.language': 'Language', 'settings.quality': 'Graphics', 'settings.low': 'Low',
  'settings.medium': 'Medium', 'settings.high': 'High', 'settings.music': 'Music', 'settings.sfx': 'Sounds', 'settings.voice': 'Voice',
  'settings.mute': 'Mute', 'settings.vibration': 'Vibration', 'settings.textSize': 'Text size', 'settings.colorBlind': 'Color-blind friendly bars',
  'settings.reduceMotion': 'Reduce motion', 'settings.export': 'Export save', 'settings.import': 'Import save',
  'settings.reset': 'Reset progress', 'settings.about': 'About', 'settings.close': 'Close',
  'reset.title': 'Reset everything?', 'reset.body': 'Level, coins and needs go back to the start. Settings stay.',
  'reset.cancel': 'Keep playing', 'reset.confirm': 'Reset',
  'about.title': 'About Sylvia', 'about.body': 'A cozy kitten to feed, wash, cuddle and put to bed. No ads, no payments, everything is earned by playing. Made with React and three.js.',
  'loading': 'Waking Sylvia up…',
  'stage.baby': 'Baby', 'stage.kid': 'Kid', 'stage.teen': 'Teen', 'stage.adult': 'Adult',
};

const fa: Dict = {
  'need.hunger': 'گرسنگی', 'need.hygiene': 'نظافت', 'need.bladder': 'دستشویی',
  'need.energy': 'انرژی', 'need.happiness': 'شادی', 'need.affection': 'محبت',
  'room.living': 'پذیرایی', 'room.kitchen': 'آشپزخانه', 'room.bathroom': 'حمام', 'room.bedroom': 'اتاق خواب',
  'cat.fruits': 'میوه', 'cat.meals': 'غذا', 'cat.sweets': 'شیرینی', 'cat.drinks': 'نوشیدنی', 'cat.fish': 'ماهی', 'cat.veggies': 'سبزی',
  'food.apple': 'سیب', 'food.banana': 'موز', 'food.strawberry': 'توت‌فرنگی', 'food.watermelon': 'هندوانه',
  'food.riceball': 'گلوله برنجی', 'food.noodles': 'نودل', 'food.sandwich': 'ساندویچ', 'food.pizza': 'پیتزا',
  'food.cookie': 'کلوچه', 'food.cake': 'کیک', 'food.donut': 'دونات', 'food.icecream': 'بستنی',
  'food.milk': 'شیر', 'food.juice': 'آبمیوه', 'food.tea': 'چای', 'food.smoothie': 'اسموتی',
  'food.fish': 'ماهی', 'food.sushi': 'سوشی', 'food.shrimp': 'میگو', 'food.sardine': 'ساردین',
  'food.carrot': 'هویج', 'food.broccoli': 'بروکلی', 'food.corn': 'ذرت', 'food.tomato': 'گوجه',
  'act.fridge': 'یخچال', 'act.bath': 'حمام', 'act.toilet': 'دستشویی', 'act.sleep': 'خواب', 'act.wake': 'بیدار کن',
  'act.hug': 'بغل', 'act.play': 'بازی', 'act.back': 'تمام',
  'food.title': '{name} چی بخوره؟', 'food.hint': 'روی غذا بزن یا بکشش تا دهان او.', 'food.locked': 'سطح {n}',
  'bath.sponge': 'صابون', 'bath.shower': 'دوش', 'bath.towel': 'حوله',
  'bath.hint.sponge': 'صابون رو روی {name} بکش!', 'bath.hint.shower': 'کف‌ها را بشوی.', 'bath.hint.towel': 'موهای پفی‌اش را خشک کن.',
  'toast.love': 'به‌به! غذای مورد علاقه‌اش!', 'toast.yum': 'نوش جان~', 'toast.yuck': 'اَعع! از این خوشش نمیاد.',
  'toast.full': 'ارّر! حسابی سیر شد.', 'toast.sleeping': 'هیس… خوابیده.', 'toast.locked': 'در سطح {n} باز می‌شود.',
  'toast.clean': 'تمیز و پفی شد!', 'toast.toiletDone': 'آخیش، عالی شد!', 'toast.notNeeded': 'هنوز دستشویی نمی‌خواد.',
  'toast.busy': 'یک لحظه…', 'toast.grumpy': 'بدخلقه… خواب بیشتری لازم داشت.', 'toast.rested': 'صبح بخیر!',
  'toast.imported': 'فایل ذخیره وارد شد.', 'toast.importFail': 'این فایل، ذخیره‌ی معتبر سیلویا نیست.',
  'toast.playDone': 'چه بازی خوبی!', 'toast.tooTired': 'برای بازی خیلی خسته است.',
  'want.food': 'گرسنمه!', 'want.toilet': 'دستشویی!', 'want.bed': 'خوابم میاد…', 'want.bath': 'کثیفم…', 'want.heart': 'نازم کن؟',
  'welcome.title': 'خوش برگشتی!', 'welcome.body': 'دلِ {name} برایت تنگ شده بود. {time} نبودی.',
  'welcome.changes': 'در نبودت', 'welcome.continue': 'ادامه',
  'time.min': '{n} دقیقه', 'time.hour': '{n} ساعت', 'time.hourmin': '{h} ساعت و {m} دقیقه',
  'levelup.title': 'سطح {n}!', 'levelup.body': '{name} بزرگ‌تر شد. جایزه: {coins} سکه.', 'levelup.unlocks': 'غذاهای جدید:',
  'name.title': 'اسم بچه‌گربه', 'name.body': 'هر بچه‌گربه‌ای یک اسم لازم دارد.', 'name.placeholder': 'سیلویا', 'name.start': 'شروع',
  'settings.title': 'تنظیمات', 'settings.language': 'زبان', 'settings.quality': 'کیفیت گرافیک', 'settings.low': 'کم',
  'settings.medium': 'متوسط', 'settings.high': 'زیاد', 'settings.music': 'موسیقی', 'settings.sfx': 'افکت‌ها', 'settings.voice': 'صدا',
  'settings.mute': 'بی‌صدا', 'settings.vibration': 'لرزش', 'settings.textSize': 'اندازه‌ی نوشته', 'settings.colorBlind': 'نوار مناسب کوررنگی',
  'settings.reduceMotion': 'کاهش حرکت', 'settings.export': 'خروجی ذخیره', 'settings.import': 'ورود ذخیره',
  'settings.reset': 'شروع دوباره', 'settings.about': 'درباره', 'settings.close': 'بستن',
  'reset.title': 'همه‌چیز پاک شود؟', 'reset.body': 'سطح، سکه و نیازها به اول برمی‌گردند. تنظیمات می‌مانند.',
  'reset.cancel': 'ادامه می‌دهم', 'reset.confirm': 'پاک کن',
  'about.title': 'درباره‌ی سیلویا', 'about.body': 'یک بچه‌گربه‌ی دوست‌داشتنی برای غذا دادن، شستن، نازکردن و خواباندن. بدون تبلیغ و پرداخت؛ همه‌چیز با بازی کردن به دست می‌آید. ساخته‌شده با React و three.js.',
  'loading': 'در حال بیدار کردن سیلویا…',
  'stage.baby': 'نوزاد', 'stage.kid': 'بچه', 'stage.teen': 'نوجوان', 'stage.adult': 'بزرگسال',
};

const DICTS: Record<Lang, Dict> = { en, fa };

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = DICTS[lang][key] ?? en[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
  return s;
}

/** Non-hook translate for game logic (toasts etc.). */
export const tr = (key: string, vars?: Record<string, string | number>) =>
  translate(useGameStore.getState().settings.lang, key, vars);

export function useT() {
  const lang = useGameStore((s) => s.settings.lang);
  return useCallback((key: string, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
}

export function formatDuration(lang: Lang, seconds: number): string {
  const m = Math.max(1, Math.round(seconds / 60));
  if (m < 60) return translate(lang, 'time.min', { n: m });
  const h = Math.floor(m / 60), r = m % 60;
  return r === 0 ? translate(lang, 'time.hour', { n: h }) : translate(lang, 'time.hourmin', { h, m: r });
}
