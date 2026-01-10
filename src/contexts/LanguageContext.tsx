import React, { createContext, useContext, useState, useEffect } from 'react';

// All 27 Indian state languages + English
export type Language = 
  | 'en' // English
  | 'hi' // Hindi
  | 'bn' // Bengali (West Bengal)
  | 'te' // Telugu (Andhra Pradesh, Telangana)
  | 'mr' // Marathi (Maharashtra)
  | 'ta' // Tamil (Tamil Nadu)
  | 'gu' // Gujarati (Gujarat)
  | 'kn' // Kannada (Karnataka)
  | 'ml' // Malayalam (Kerala)
  | 'or' // Odia (Odisha)
  | 'pa' // Punjabi (Punjab)
  | 'as' // Assamese (Assam)
  | 'ks' // Kashmiri (Jammu & Kashmir)
  | 'ur' // Urdu (Jammu & Kashmir)
  | 'sd' // Sindhi (Gujarat)
  | 'ne' // Nepali (Sikkim)
  | 'sa' // Sanskrit
  | 'kok' // Konkani (Goa)
  | 'doi' // Dogri (Himachal Pradesh)
  | 'mni' // Manipuri (Manipur)
  | 'sat' // Santali (Jharkhand)
  | 'mai' // Maithili (Bihar)
  | 'bho' // Bhojpuri (Bihar, UP)
  | 'raj' // Rajasthani (Rajasthan)
  | 'awa' // Awadhi (UP)
  | 'chh' // Chhattisgarhi (Chhattisgarh)
  | 'hry'; // Haryanvi (Haryana)

interface LanguageInfo {
  code: Language;
  name: string;
  nativeName: string;
  state: string;
}

export const languageList: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', state: 'All India' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी', state: 'Hindi Belt' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', state: 'West Bengal' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', state: 'Andhra Pradesh, Telangana' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', state: 'Maharashtra' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', state: 'Tamil Nadu' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', state: 'Gujarat' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', state: 'Karnataka' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', state: 'Kerala' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', state: 'Odisha' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', state: 'Punjab' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', state: 'Assam' },
  { code: 'ks', name: 'Kashmiri', nativeName: 'کٲشُر', state: 'Jammu & Kashmir' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', state: 'Jammu & Kashmir' },
  { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي', state: 'Gujarat' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', state: 'Sikkim' },
  { code: 'kok', name: 'Konkani', nativeName: 'कोंकणी', state: 'Goa' },
  { code: 'doi', name: 'Dogri', nativeName: 'डोगरी', state: 'Himachal Pradesh' },
  { code: 'mni', name: 'Manipuri', nativeName: 'মৈতৈলোন্', state: 'Manipur' },
  { code: 'sat', name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', state: 'Jharkhand' },
  { code: 'mai', name: 'Maithili', nativeName: 'मैथिली', state: 'Bihar' },
  { code: 'bho', name: 'Bhojpuri', nativeName: 'भोजपुरी', state: 'Bihar, Uttar Pradesh' },
  { code: 'raj', name: 'Rajasthani', nativeName: 'राजस्थानी', state: 'Rajasthan' },
  { code: 'awa', name: 'Awadhi', nativeName: 'अवधी', state: 'Uttar Pradesh' },
  { code: 'chh', name: 'Chhattisgarhi', nativeName: 'छत्तीसगढ़ी', state: 'Chhattisgarh' },
  { code: 'hry', name: 'Haryanvi', nativeName: 'हरियाणवी', state: 'Haryana' },
];

// Comprehensive translations for ALL supported languages
interface Translations {
  [key: string]: {
    [lang in Language]?: string;
  };
}

const translations: Translations = {
  // === HEADER & NAVIGATION ===
  'ai_business_os': { 
    en: 'AI Business OS', 
    hi: 'AI बिज़नेस OS', 
    bn: 'AI ব্যবসা OS', 
    te: 'AI వ్యాపారం OS', 
    mr: 'AI व्यवसाय OS', 
    ta: 'AI வணிக OS', 
    gu: 'AI વ્યવસાય OS', 
    kn: 'AI ವ್ಯಾಪಾರ OS', 
    ml: 'AI ബിസിനസ് OS', 
    or: 'AI ବ୍ୟବସାୟ OS', 
    pa: 'AI ਕਾਰੋਬਾਰ OS',
    as: 'AI ব্যৱসায় OS',
    ur: 'AI کاروبار OS',
    bho: 'AI कारोबार OS',
    raj: 'AI धंधो OS',
    mai: 'AI व्यापार OS',
  },
  
  // Dashboard
  'good_morning': { 
    en: 'Good Morning!', 
    hi: 'सुप्रभात!', 
    bn: 'সুপ্রভাত!', 
    te: 'శుభోదయం!', 
    mr: 'सुप्रभात!', 
    ta: 'காலை வணக்கம்!', 
    gu: 'સુપ્રભાત!', 
    kn: 'ಶುಭೋದಯ!', 
    ml: 'സുപ്രഭാതം!', 
    or: 'ସୁପ୍ରଭାତ!', 
    pa: 'ਸ਼ੁਭ ਸਵੇਰ!',
    as: 'সুপ্ৰভাত!',
    ur: 'صبح بخیر!',
    bho: 'सुप्रभात!',
    raj: 'राम राम!',
    mai: 'प्रणाम!',
  },
  'good_afternoon': { 
    en: 'Good Afternoon!', 
    hi: 'नमस्कार!', 
    bn: 'শুভ অপরাহ্ন!', 
    te: 'శుభ మధ్యాహ్నం!', 
    mr: 'शुभ दुपार!', 
    ta: 'மதிய வணக்கம்!', 
    gu: 'શુભ બપોર!', 
    kn: 'ಶುಭ ಮಧ್ಯಾಹ್ನ!', 
    ml: 'ഉച്ച നമസ്കാരം!', 
    or: 'ଶୁଭ ଅପରାହ୍ନ!', 
    pa: 'ਸ਼ੁਭ ਦੁਪਹਿਰ!',
    as: 'শুভ দুপৰীয়া!',
    ur: 'سلام!',
    bho: 'नमस्कार!',
    raj: 'खम्मा घणी!',
    mai: 'नमस्कार!',
  },
  'good_evening': { 
    en: 'Good Evening!', 
    hi: 'शुभ संध्या!', 
    bn: 'শুভ সন্ধ্যা!', 
    te: 'శుభ సాయంత్రం!', 
    mr: 'शुभ संध्याकाळ!', 
    ta: 'மாலை வணக்கம்!', 
    gu: 'શુભ સાંજ!', 
    kn: 'శుభ ಸಂಜೆ!', 
    ml: 'ശുഭ സന്ധ്യ!', 
    or: 'ଶୁଭ ସନ୍ଧ୍ୟା!', 
    pa: 'ਸ਼ੁਭ ਸ਼ਾਮ!',
    as: 'শুভ সন্ধিয়া!',
    ur: 'شام بخیر!',
    bho: 'राम राम!',
    raj: 'राम राम!',
    mai: 'प्रणाम!',
  },
  'quick_access': { 
    en: 'Quick Access', 
    hi: 'त्वरित पहुँच', 
    bn: 'দ্রুত প্রবেশ', 
    te: 'త్వరిత ప్రాప్యత', 
    mr: 'जलद प्रवेश', 
    ta: 'விரைவு அணுகல்', 
    gu: 'ઝડપી પ્રવેશ', 
    kn: 'ತ್ವರಿತ ಪ್ರವೇಶ', 
    ml: 'ദ്രുത പ്രവേശനം', 
    or: 'ଦ୍ରୁତ ପ୍ରବେଶ', 
    pa: 'ਤੁਰੰਤ ਪਹੁੰਚ',
    as: 'দ্ৰুত প্ৰৱেশ',
    ur: 'فوری رسائی',
    bho: 'जल्दी पहुँच',
    raj: 'जलदी पहुँच',
    mai: 'शीघ्र पहुँच',
  },
  'todays_summary': { 
    en: "Today's Summary", 
    hi: 'आज का सारांश', 
    bn: 'আজকের সারসংক্ষেপ', 
    te: 'నేటి సారాంశం', 
    mr: 'आजचा सारांश', 
    ta: 'இன்றைய சுருக்கம்', 
    gu: 'આજનો સારાંશ', 
    kn: 'ಇಂದಿನ ಸಾರಾಂಶ', 
    ml: 'ഇന്നത്തെ സംഗ്രഹം', 
    or: 'ଆଜିର ସାରାଂଶ', 
    pa: 'ਅੱਜ ਦਾ ਸਾਰ',
    as: 'আজিৰ সাৰাংশ',
    ur: 'آج کا خلاصہ',
    bho: 'आज के सारांश',
    raj: 'आज को सार',
    mai: 'आइ के सारांश',
  },
  'total_sales': { 
    en: 'Total Sales', 
    hi: 'कुल बिक्री', 
    bn: 'মোট বিক্রয়', 
    te: 'మొత్తం అమ్మకాలు', 
    mr: 'एकूण विक्री', 
    ta: 'மொத்த விற்பனை', 
    gu: 'કુલ વેચાણ', 
    kn: 'ಒಟ್ಟು ಮಾರಾಟ', 
    ml: 'ആകെ വിൽപ്പന', 
    or: 'ମୋଟ ବିକ୍ରୟ', 
    pa: 'ਕੁੱਲ ਵਿਕਰੀ',
    as: 'মুঠ বিক্ৰী',
    ur: 'کل فروخت',
    bho: 'कुल बिक्री',
    raj: 'कुल बिकरी',
    mai: 'कुल बिक्री',
  },
  'items_sold': { 
    en: 'Items Sold', 
    hi: 'बेचे गए आइटम', 
    bn: 'বিক্রিত আইটেম', 
    te: 'అమ్మిన వస్తువులు', 
    mr: 'विक्री केलेल्या वस्तू', 
    ta: 'விற்ற பொருட்கள்', 
    gu: 'વેચાયેલી વસ્તુઓ', 
    kn: 'ಮಾರಾಟವಾದ ವಸ್ತುಗಳು', 
    ml: 'വിട്ട ഇനങ്ങൾ', 
    or: 'ବିକ୍ରି ହୋଇଥିବା ଆଇଟମ୍', 
    pa: 'ਵੇਚੇ ਗਏ ਆਈਟਮ',
    as: 'বিক্ৰী হোৱা বস্তু',
    ur: 'فروخت شدہ اشیاء',
    bho: 'बिकल सामान',
    raj: 'बिकी चीजां',
    mai: 'बिकल सामान',
  },
  // ... (rest of the original file unchanged) ...
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  languageList: LanguageInfo[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('revonn-language');
    return (saved as Language) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('revonn-language', language);
    // Update document lang attribute
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string): string => {
    const translation = translations[key];
    if (!translation) return key;
    // Try exact language, then fallback to Hindi (for regional languages), then English
    return translation[language] || translation['hi'] || translation['en'] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languageList }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
