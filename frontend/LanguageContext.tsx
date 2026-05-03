import { createContext, ReactNode, useContext, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  buildLocalizedPath,
  COPY,
  DEFAULT_SITE_LANGUAGE,
  getLanguageCopy,
  isRtlLanguage,
  resolveSiteLanguage,
  SITE_LANGUAGE_STORAGE_KEY,
  stripLanguageFromPath,
} from './siteLanguage'

type CopySchema = typeof COPY.ar
type Language = keyof typeof COPY

const copySchemaByLanguage = COPY as { [Key in Language]: CopySchema }

type LanguageCopy = CopySchema

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
  const copy = getLanguageCopy(language) as LanguageCopy
  const isRTL = isRtlLanguage(language)

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
