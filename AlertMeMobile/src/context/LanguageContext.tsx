import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import i18n from "../i18n/i18n";

type LanguageContextType = {
  locale: string;
  setLocale: (lang: string) => void;
};

const LanguageContext = createContext<LanguageContextType>({
  locale: "en",
  setLocale: () => {},
});

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [locale, setLocaleState] = useState(i18n.locale);

  useEffect(() => {
    // Load saved language on mount
    AsyncStorage.getItem("app_language").then((savedLang) => {
      if (savedLang) {
        i18n.locale = savedLang;
        setLocaleState(savedLang);
      }
    });
  }, []);

  const setLocale = async (lang: string) => {
    i18n.locale = lang;
    setLocaleState(lang);
    await AsyncStorage.setItem("app_language", lang);
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
