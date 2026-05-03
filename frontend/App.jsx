import { useEffect, useState } from 'react'
import { Routes, Route, Link, Navigate, useLocation, useParams } from 'react-router-dom'
import BibleReader from './pages/bible'
import OntologyEditPage from './pages/ontology/edit'
import OntologyViewPage from './pages/ontology/index'
import OntologyAddPage from './pages/ontology/new'
import OntologyConceptViewPage from './pages/ontology/view'
import QuranIndex from './pages/quran/index'
import QuranSearch from './pages/quran/search'
import QuranSemantic from './pages/quran/semantic'
import {
  buildLocalizedPath,
  DEFAULT_SITE_LANGUAGE,
  getBiblePath,
  getBibleSearchPath,
  getHomePath,
  getQuranPath,
  getQuranSearchPath,
  getOntologyViewPath,
  isSupportedLanguage,
  resolveSiteLanguage,
  SITE_LANGUAGE_OPTIONS,
  SITE_LANGUAGE_STORAGE_KEY
} from './siteLanguage'
import { LanguageProvider, useLanguage } from './LanguageContext'
import './App.css'

function getStoredLanguage() {
  return resolveSiteLanguage(localStorage.getItem(SITE_LANGUAGE_STORAGE_KEY), DEFAULT_SITE_LANGUAGE)
}

function LegacyRedirect({ targetPath }) {
  const location = useLocation()
  const preferredLanguage = getStoredLanguage()
  const nextPath = buildLocalizedPath(preferredLanguage, targetPath || location.pathname)

  return <Navigate to={`${nextPath}${location.search}${location.hash}`} replace />
}

function CanonicalLanguageRedirect({ targetPath }) {
  const { language } = useParams()
  const location = useLocation()
  const resolvedLanguage = resolveSiteLanguage(language, getStoredLanguage())

  return <Navigate to={`${buildLocalizedPath(resolvedLanguage, targetPath)}${location.search}${location.hash}`} replace />
}

function LanguageGuard({ children }) {
  const { language } = useParams()
  const location = useLocation()

  if (isSupportedLanguage(language)) {
    return children
  }

  const fallbackLanguage = getStoredLanguage()
  const segments = location.pathname.split('/').filter(Boolean)
  const restPath = segments.slice(1).join('/')
  const redirectPath = restPath ? `/${fallbackLanguage}/${restPath}` : `/${fallbackLanguage}`

  return <Navigate to={`${redirectPath}${location.search}${location.hash}`} replace />
}

function SearchQueryRedirect({ buildSearchPath, fallbackPath, children }) {
  const { language } = useParams()
  const location = useLocation()
  const resolvedLanguage = resolveSiteLanguage(language, getStoredLanguage())
  const searchParams = new URLSearchParams(location.search)
  const query = searchParams.get('q')?.trim()

  if (!query) {
    if (children) {
      return children
    }

    return <Navigate to={`${buildLocalizedPath(resolvedLanguage, fallbackPath)}${location.hash}`} replace />
  }

  searchParams.delete('q')
  const remainingQuery = searchParams.toString()
  const redirectSuffix = `${remainingQuery ? `?${remainingQuery}` : ''}${location.hash}`

  return <Navigate to={`${buildSearchPath(resolvedLanguage, query)}${redirectSuffix}`} replace />
}

function SearchRouteCanonicalRedirect({ buildSearchPath, fallbackPath, children }) {
  const { language, term } = useParams()
  const location = useLocation()
  const resolvedLanguage = resolveSiteLanguage(language, getStoredLanguage())
  const searchParams = new URLSearchParams(location.search)
  const query = searchParams.get('q')?.trim()
  const relatedTag = searchParams.get('relatedTag')?.trim()
  const routeTerm = String(term || '').trim()
  const canonicalTerm = relatedTag || query || routeTerm

  if (!canonicalTerm) {
    return <Navigate to={`${buildLocalizedPath(resolvedLanguage, fallbackPath)}${location.hash}`} replace />
  }

  if (relatedTag || query || canonicalTerm !== routeTerm) {
    searchParams.delete('q')
    searchParams.delete('relatedTag')
    const remainingQuery = searchParams.toString()
    const redirectSuffix = `${remainingQuery ? `?${remainingQuery}` : ''}${location.hash}`
    return <Navigate to={`${buildSearchPath(resolvedLanguage, canonicalTerm)}${redirectSuffix}`} replace />
  }

  return children
}

function AppContent() {
  const { language, setLanguage, copy, isRTL } = useLanguage()

  const [theme, setTheme] = useState(() => localStorage.getItem('reader-theme') || 'light')
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('reader-theme', theme)
  }, [theme])

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light')
  const handleLanguageChange = (event) => setLanguage(event.target.value)

  return (
    <div className={`app-shell ${isRTL ? 'app-shell--rtl' : 'app-shell--ltr'}`}>
      <header className="global-header" style={{background:'black'}}>
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <Link to={getHomePath(language)} className="brand-logo" 
          style={{ textDecoration: 'none', color: 'white', fontWeight: '700', fontSize: '1.2rem', fontFamily: 'var(--font-serif)' }}>
            {copy.brand}
          </Link>
          <div className="flex items-center gap-6" style={{color:'white'}}>
            <Link to={getQuranPath(language)}>{copy.quran}</Link>
            <Link to={getBiblePath(language)}>{copy.bible}</Link>
            <Link to={getOntologyViewPath(language)}>{copy.Ontology}</Link>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              style={{ background: 'transparent', border: '1px solid gray', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '1rem', color: 'white', lineHeight: 1 }}
            >
              {theme === 'light' ? copy.themeDarkMode : copy.themeLightMode}
            </button>
            <select
              value={language}
              onChange={handleLanguageChange}
              className="rounded border px-2 py-1 text-[0.8rem]"
              style={{ color:'white', width: 'auto', border: '1px solid gray', fontSize: '0.8rem', borderRadius: '4px' }}
              aria-label={copy.language}>
              {SITE_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Scroll to top button */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Go to top"
          style={{
            position: 'fixed',
            bottom: '30px',
            right: isRTL ? 'auto' : '30px',
            left: isRTL ? '30px' : 'auto',
            zIndex: 1100,
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'var(--color-accent)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-md)',
            fontSize: '1.1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.2s ease'
          }}
        >
          ↑
        </button>
      )}

      <main>
        <Routes>
          <Route path="/" element={<LegacyRedirect targetPath="/" />} />
          <Route path="/bible" element={<LegacyRedirect targetPath="/bible/0/1" />} />
          <Route path="/bible/:bookId/:chapterId" element={<LegacyRedirect />} />
          <Route path="/bible/search" element={<LegacyRedirect targetPath="/bible/0/1" />} />
          <Route path="/bible/search/:term" element={<LegacyRedirect />} />
          <Route path="/quran" element={<LegacyRedirect targetPath="/quran/1" />} />
          <Route path="/quran/ontology" element={<LegacyRedirect targetPath="/quran/ontology" />} />
          <Route path="/quran/ontology/concepts" element={<LegacyRedirect targetPath="/quran/ontology/concepts" />} />
          <Route path="/quran/:surahId" element={<LegacyRedirect />} />
          <Route path="/quran/search" element={<LegacyRedirect targetPath="/quran/1" />} />
          <Route path="/quran/search/:term" element={<LegacyRedirect />} />
          <Route path="/:language" element={
            <LanguageGuard>
              <div className="welcome-section flex items-center justify-center" style={{ minHeight: '80vh' }}>
                <div className="text-center" style={{ maxWidth: '600px', padding: '2rem' }}>
                  <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '3rem', marginBottom: '1.5rem' }}>{copy.welcomeTitle}</h1>
                  <p className="text-muted" style={{ fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '2.5rem' }}>{copy.welcomeSubtitle}</p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <Link to={getQuranPath(language)} className="nav-link">{copy.quran}</Link>
                    <Link to={getBiblePath(language)} className="nav-link">{copy.bible}</Link>
                    <Link to={getOntologyViewPath(language)} className="nav-link">{copy.Ontology}</Link>
                  </div>
                </div>
              </div>
            </LanguageGuard>
          } />
          <Route path="/:language/bible" element={<CanonicalLanguageRedirect targetPath="/bible/0/1" />} />
          <Route path="/:language/bible/search" element={<LanguageGuard><SearchQueryRedirect buildSearchPath={getBibleSearchPath} fallbackPath="/bible/0/1" /></LanguageGuard>} />
          <Route path="/:language/quran" element={<CanonicalLanguageRedirect targetPath="/quran/1" />} />
          <Route path="/:language/quran/ontology" element={<LanguageGuard><OntologyAddPage /></LanguageGuard>} />
          <Route path="/:language/quran/ontology/concepts" element={<LanguageGuard><OntologyViewPage /></LanguageGuard>} />
          <Route path="/:language/quran/ontology/concepts/:conceptId/view" element={<LanguageGuard><OntologyConceptViewPage /></LanguageGuard>} />
          <Route path="/:language/quran/ontology/concepts/:conceptId" element={<LanguageGuard><OntologyEditPage /></LanguageGuard>} />
          <Route path="/:language/quran/search" element={<LanguageGuard><SearchQueryRedirect buildSearchPath={getQuranSearchPath} fallbackPath="/quran/1" /></LanguageGuard>} />
          <Route path="/:language/bible/search/:term" element={<LanguageGuard><SearchRouteCanonicalRedirect buildSearchPath={getBibleSearchPath} fallbackPath="/bible/0/1"><BibleReader /></SearchRouteCanonicalRedirect></LanguageGuard>} />
          <Route path="/:language/quran/search/:term" element={<LanguageGuard><SearchRouteCanonicalRedirect buildSearchPath={getQuranSearchPath} fallbackPath="/quran/1"><QuranSearch /></SearchRouteCanonicalRedirect></LanguageGuard>} />
          <Route path="/:language/bible/:bookId/:chapterId" element={<LanguageGuard><SearchQueryRedirect buildSearchPath={getBibleSearchPath}><BibleReader /></SearchQueryRedirect></LanguageGuard>} />
          <Route path="/:language/quran/tree/:treeSurahId/:treeVerseNum" element={<LanguageGuard><QuranSemantic /></LanguageGuard>} />
          <Route path="/:language/quran/:surahId" element={<LanguageGuard><SearchQueryRedirect buildSearchPath={getQuranSearchPath}><QuranIndex /></SearchQueryRedirect></LanguageGuard>} />
          <Route path="*" element={<LegacyRedirect targetPath="/" />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  )
}
