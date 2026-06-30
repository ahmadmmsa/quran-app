import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  buildLocalizedPath,
  DEFAULT_SITE_LANGUAGE,
  isRtlLanguage,
  isSupportedLanguage,
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
  // On non-localized routes (e.g. /admin/*) the active language comes from this
  // stored preference, so it must live in state to re-render when changed there.
  const [preferredLanguage, setPreferredLanguage] = useState<Language>(getStoredLanguage())
  const language = resolveSiteLanguage(firstSegment, preferredLanguage) as Language
  const isRTL = isRtlLanguage(language)

  const [locales, setLocales] = useState<Record<Language, LanguageCopy>>({});
  const [copy, setCopy] = useState<LanguageCopy>({});
  
  const fallbackCopy = { "loading": "Loading..." }; 

  useEffect(() => {
    fetch('/locales.json')
      .then(r => r.json())
      .then(data => {
        setLocales(data);
      })
      .catch(e => {
        console.error("Failed to load locales.json", e);
        setCopy(fallbackCopy);
      });
  }, []);

  // Single owner of `copy`: pick the active language once locales are loaded,
  // falling back to English then the minimal fallback.
  useEffect(() => {
    if (Object.keys(locales).length === 0) return;
    setCopy(locales[language] || locales.en || fallbackCopy);
  }, [language, locales]);

  useEffect(() => {
    localStorage.setItem(SITE_LANGUAGE_STORAGE_KEY, language)
    // Keep the stored preference in sync when the language is driven by the URL.
    setPreferredLanguage(language)
    document.documentElement.lang = language
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr'
  }, [isRTL, language])

  const setLanguage = (nextLanguage: string) => {
    const resolvedLanguage = resolveSiteLanguage(nextLanguage, language)

    // Non-localized routes (e.g. /admin/*) have no language segment to swap, so
    // navigating to a localized path would 404 and bounce home. Persist the
    // preference and re-render in place instead.
    if (!isSupportedLanguage(firstSegment)) {
      localStorage.setItem(SITE_LANGUAGE_STORAGE_KEY, resolvedLanguage)
      setPreferredLanguage(resolvedLanguage)
      return
    }

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
