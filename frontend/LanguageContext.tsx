import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  buildLocalizedPath,
  DEFAULT_SITE_LANGUAGE,
  isRtlLanguage,
  resolveSiteLanguage,
  SITE_LANGUAGE_STORAGE_KEY,
  stripLanguageFromPath,
} from './siteLanguage'

type Language = string;
type LanguageCopy = Record<string, string>;

type LanguageContextValue = {
  language: Language
  setLanguage: (language: string) => void
  copy: LanguageCopy
  isRTL: boolean
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function getStoredLanguage() {
  return resolveSiteLanguage(
    localStorage.getItem(SITE_LANGUAGE_STORAGE_KEY),
    DEFAULT_SITE_LANGUAGE,
  ) as Language
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const firstSegment = location.pathname.split('/').filter(Boolean)[0] || ''
  const storedLanguage = getStoredLanguage()
  const language = resolveSiteLanguage(firstSegment, storedLanguage) as Language
  const isRTL = isRtlLanguage(language)

  const [locales, setLocales] = useState<Record<Language, LanguageCopy>>({});
  const [copy, setCopy] = useState<LanguageCopy>({});
  
  const fallbackCopy = { "loading": "Loading..." }; 

  useEffect(() => {
    fetch('/locales.json')
      .then(r => r.json())
      .then(data => {
        setLocales(data);
        setCopy(data[language] || data.en || fallbackCopy);
      })
      .catch(e => {
        console.error("Failed to load locales.json", e);
        setCopy(fallbackCopy);
      });
  }, []);

  useEffect(() => {
    if (locales[language]) {
        setCopy(locales[language]);
    }
  }, [language, locales]);

  useEffect(() => {
    localStorage.setItem(SITE_LANGUAGE_STORAGE_KEY, language)
    document.documentElement.lang = language
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr'
  }, [isRTL, language])

  const setLanguage = (nextLanguage: string) => {
    const resolvedLanguage = resolveSiteLanguage(nextLanguage, language)
    const nextPath = buildLocalizedPath(
      resolvedLanguage,
      stripLanguageFromPath(location.pathname),
    )

    navigate(`${nextPath}${location.search}${location.hash}`)
  }

  // Prevent app from rendering without language strings loaded to avoid layout jumps
  if (Object.keys(locales).length === 0) {
     return <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw'}}>Loading...</div>;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, copy, isRTL }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)

  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }

  return context
}
