import { createI18n } from "vue-i18n";

// User defined lang
import en from "./lang/en";
import zhCN from "./lang/zh-CN";

export const LANFGUAGES = ["en", "zh-CN"];
export const localStorageLanguageKey = "language";
export const languageOptions: any = [
  {
    label: 'English',
    value: 'en'
  }, {
    label: '中文',
    value: 'zh-CN'
  }
]
const messages = {
  "en": {
    ...en,
  },
  "zh-CN": {
    ...zhCN,
  },
};

export const initLanguage = () => {
  const lang = localStorage.getItem(localStorageLanguageKey);
  if (lang && LANFGUAGES.includes(lang)) {
    return lang;
  } else {
    localStorage.setItem(localStorageLanguageKey, "zh-CN");
    return "zh-CN";
  }
};

const i18n = createI18n({
  locale: initLanguage(),
  messages,
  globalInjection: true,
  allowComposition: true,
});

export default i18n;