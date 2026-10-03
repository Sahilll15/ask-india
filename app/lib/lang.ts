export type Lang = 'en' | 'hi' | 'hinglish';

const HINGLISH_WORDS = new Set(
  (
    'kaise kaisa kya kyu kyun kab kahan kaha kitna kitni kitne hai hain ho hoga hota hoti karna karein kare karen karu kar ' +
    'karwana banwana banaye banayein banta milega milta mila chahiye mera meri mere mujhe hum humein apna apni ' +
    'ke ki ka ko se par pe liye nahi nahin naya nayi purana wala wali aur ya bhi agar toh tho abhi kaun konsa kis jaye jaata'
  ).split(' '),
);

/** Rough language guess: Devanagari share first, then common romanised Hindi words. */
export function detectLang(text: string): Lang {
  const letters = text.match(/[A-Za-zऀ-ॿ]/g) ?? [];
  if (!letters.length) return 'en';
  const deva = letters.filter((c) => c >= 'ऀ' && c <= 'ॿ').length;
  if (deva / letters.length >= 0.3) return 'hi';
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const hits = words.filter((w) => HINGLISH_WORDS.has(w)).length;
  if (hits >= 2 || (words.length > 0 && hits / words.length >= 0.25 && hits >= 1 && words.length <= 4)) return 'hinglish';
  return 'en';
}

export const LANG_NAME: Record<Lang, string> = {
  en: 'English',
  hi: 'Hindi in Devanagari script',
  hinglish: 'Hinglish (Hindi written in the Latin alphabet, mixed with English as people text it)',
};

export const FOOTER: Record<Lang, string> = {
  en: 'Check the official page before you act. Rules, fees and dates can change.',
  hi: 'कोई भी कदम उठाने से पहले आधिकारिक पेज ज़रूर देखें। नियम, शुल्क और तारीखें बदल सकती हैं।',
  hinglish: 'Kuch bhi karne se pehle official page zaroor check karein. Rules, fees aur dates badal sakti hain.',
};

export const NOT_FOUND: Record<Lang, string> = {
  en: "I couldn't confirm the exact steps on an official page just now. These official portals handle it:",
  hi: 'मैं अभी किसी आधिकारिक पेज पर सटीक प्रक्रिया की पुष्टि नहीं कर सका। ये आधिकारिक पोर्टल इसे संभालते हैं:',
  hinglish: 'Main abhi kisi official page par exact steps confirm nahi kar paya. Yeh official portals isse handle karte hain:',
};
