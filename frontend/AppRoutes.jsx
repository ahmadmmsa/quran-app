import { Routes, Route, Navigate, useLocation, useParams, Link } from 'react-router-dom';
import BibleReader from './pages/bible';
import AdminLayout from './pages/admin/Layout';
import LocalizationEditor from './pages/admin/LocalizationEditor';
import OntologyEditPage from './pages/ontology/edit';
import OntologyViewPage from './pages/ontology/index';
import OntologyAddPage from './pages/ontology/new';
import OntologyConceptViewPage from './pages/ontology/view';
import QuranIndex from './pages/quran/index';
import QuranSearch from './pages/quran/search';
import QuranSemantic from './pages/quran/semantic';
import Login from './Login';
import Register from './Register';
import ProtectedRoute from './components/ProtectedRoute';

import {
  buildLocalizedPath,
  DEFAULT_SITE_LANGUAGE,
  getBiblePath,
  getBibleSearchPath,
  getQuranPath,
  getQuranSearchPath,
  isSupportedLanguage,
  resolveSiteLanguage,
  SITE_LANGUAGE_STORAGE_KEY
} from './siteLanguage';
import { useLanguage } from './LanguageContext';

function getStoredLanguage() {
  return resolveSiteLanguage(localStorage.getItem(SITE_LANGUAGE_STORAGE_KEY), DEFAULT_SITE_LANGUAGE);
}

function LegacyRedirect({ targetPath }) {
  const location = useLocation();
  const preferredLanguage = getStoredLanguage();
  const nextPath = buildLocalizedPath(preferredLanguage, targetPath || location.pathname);

  return <Navigate to={`${nextPath}${location.search}${location.hash}`} replace />;
}

function CanonicalLanguageRedirect({ targetPath }) {
  const { language } = useParams();
  const location = useLocation();
  const resolvedLanguage = resolveSiteLanguage(language, getStoredLanguage());

  return <Navigate to={`${buildLocalizedPath(resolvedLanguage, targetPath)}${location.search}${location.hash}`} replace />;
}

function LanguageGuard({ children }) {
  const { language } = useParams();
  const location = useLocation();

  if (isSupportedLanguage(language)) {
    return children;
  }

  const fallbackLanguage = getStoredLanguage();
  
  // Create a robust URL object to handle path construction safely
  const currentUrl = new URL(location.pathname + location.search + location.hash, window.location.origin);
  const segments = currentUrl.pathname.split('/').filter(Boolean);
  
  // If the first segment is the unsupported language from useParams, replace it.
  // Otherwise, prepend the fallback language.
  if (segments[0] === language) {
    segments[0] = fallbackLanguage;
  } else {
    segments.unshift(fallbackLanguage);
  }
  
  const redirectPath = `/${segments.join('/')}`;

  return <Navigate to={`${redirectPath}${currentUrl.search}${currentUrl.hash}`} replace />;
}

function SearchQueryRedirect({ buildSearchPath, fallbackPath, children }) {
  const { language } = useParams();
  const location = useLocation();
  const resolvedLanguage = resolveSiteLanguage(language, getStoredLanguage());
  const searchParams = new URLSearchParams(location.search);
  const query = searchParams.get('q')?.trim();

  if (!query) {
    if (children) {
      return children;
    }

    return <Navigate to={`${buildLocalizedPath(resolvedLanguage, fallbackPath)}${location.hash}`} replace />;
  }

  searchParams.delete('q');
  const remainingQuery = searchParams.toString();
  const redirectSuffix = `${remainingQuery ? `?${remainingQuery}` : ''}${location.hash}`;

  return <Navigate to={`${buildSearchPath(resolvedLanguage, query)}${redirectSuffix}`} replace />;
}

function SearchRouteCanonicalRedirect({ buildSearchPath, fallbackPath, children }) {
  const { language, term } = useParams();
  const location = useLocation();
  const resolvedLanguage = resolveSiteLanguage(language, getStoredLanguage());
  const searchParams = new URLSearchParams(location.search);
  const query = searchParams.get('q')?.trim();
  const relatedTag = searchParams.get('relatedTag')?.trim();
  const routeTerm = String(term || '').trim();
  const canonicalTerm = relatedTag || query || routeTerm;

  if (!canonicalTerm) {
    return <Navigate to={`${buildLocalizedPath(resolvedLanguage, fallbackPath)}${location.hash}`} replace />;
  }

  if (relatedTag || query || canonicalTerm !== routeTerm) {
    searchParams.delete('q');
    searchParams.delete('relatedTag');
    const remainingQuery = searchParams.toString();
    const redirectSuffix = `${remainingQuery ? `?${remainingQuery}` : ''}${location.hash}`;
    return <Navigate to={`${buildSearchPath(resolvedLanguage, canonicalTerm)}${redirectSuffix}`} replace />;
  }

  return children;
}

export default function AppRoutes() {
  const { language, copy } = useLanguage();

  return (
    <Routes>
          {/* Admin Auth Routes */}
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin/register" element={<Register />} />

          {/* Admin Protected Routes */}
          <Route path="/admin" element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Navigate to="localization" replace />} />
              <Route path="localization" element={<LocalizationEditor />} />
              <Route path="ontology" element={<OntologyAddPage />} />
              <Route path="ontology/concepts" element={<OntologyViewPage isAdmin={true} />} />
              <Route path="ontology/concepts/:conceptId/view" element={<OntologyConceptViewPage isAdmin={true} />} />
              <Route path="ontology/concepts/:conceptId" element={<OntologyEditPage />} />
            </Route>
          </Route>

      <Route path="/" element={<LegacyRedirect targetPath="/" />} />
      <Route path="/bible" element={<LegacyRedirect targetPath="/bible/0/1" />} />
      <Route path="/bible/:bookId/:chapterId" element={<LegacyRedirect />} />
      <Route path="/bible/search" element={<LegacyRedirect targetPath="/bible/0/1" />} />
      <Route path="/bible/search/:term" element={<LegacyRedirect />} />
      <Route path="/quran" element={<LegacyRedirect targetPath="/quran/1" />} />
      <Route path="/quran/:surahId" element={<LegacyRedirect />} />
      <Route path="/quran/search" element={<LegacyRedirect targetPath="/quran/1" />} />
      <Route path="/quran/search/:term" element={<LegacyRedirect />} />
      <Route path="/quran/ontology" element={<LegacyRedirect targetPath="/quran/ontology/concepts" />} />
      <Route path="/quran/ontology/concepts" element={<LegacyRedirect targetPath="/quran/ontology/concepts" />} />
      <Route path="/quran/ontology/concepts/:conceptId" element={<LegacyRedirect />} />
      <Route path="/quran/ontology/concepts/:conceptId/view" element={<LegacyRedirect />} />
      <Route path="/:language" element={
        <LanguageGuard>
          <div className="welcome-section flex items-center justify-center" style={{ minHeight: '80vh' }}>
            <div className="text-center" style={{ maxWidth: '600px', padding: '2rem' }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: '1rem' }}>{copy.welcomeTitle}</h1>
              <p className="text-muted" style={{ fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '2.5rem' }}>{copy.welcomeSubtitle}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link to={getQuranPath(language)} className="nav-link">{copy.quran}</Link>
                <Link to={getBiblePath(language)} className="nav-link">{copy.bible}</Link>
              </div>
            </div>
          </div>
        </LanguageGuard>
      } />
      <Route path="/:language/bible" element={<CanonicalLanguageRedirect targetPath="/bible/0/1" />} />
      <Route path="/:language/bible/search" element={<LanguageGuard><SearchQueryRedirect buildSearchPath={getBibleSearchPath} fallbackPath="/bible/0/1" /></LanguageGuard>} />
      <Route path="/:language/quran" element={<CanonicalLanguageRedirect targetPath="/quran/1" />} />
      <Route path="/:language/quran/ontology" element={<CanonicalLanguageRedirect targetPath="/quran/ontology/concepts" />} />
      <Route path="/:language/quran/ontology/concepts" element={<LanguageGuard><OntologyViewPage isAdmin={false} /></LanguageGuard>} />
      <Route path="/:language/quran/ontology/concepts/:conceptId/view" element={<LanguageGuard><OntologyConceptViewPage isAdmin={false} /></LanguageGuard>} />
      <Route path="/:language/quran/ontology/concepts/:conceptId" element={<Navigate to="view" replace />} />
      <Route path="/:language/quran/search" element={<LanguageGuard><SearchQueryRedirect buildSearchPath={getQuranSearchPath} fallbackPath="/quran/1" /></LanguageGuard>} />
      <Route path="/:language/bible/search/:term" element={<LanguageGuard><SearchRouteCanonicalRedirect buildSearchPath={getBibleSearchPath} fallbackPath="/bible/0/1"><BibleReader /></SearchRouteCanonicalRedirect></LanguageGuard>} />
      <Route path="/:language/quran/search/:term" element={<LanguageGuard><SearchRouteCanonicalRedirect buildSearchPath={getQuranSearchPath} fallbackPath="/quran/1"><QuranSearch /></SearchRouteCanonicalRedirect></LanguageGuard>} />
      <Route path="/:language/bible/:bookId/:chapterId" element={<LanguageGuard><SearchQueryRedirect buildSearchPath={getBibleSearchPath}><BibleReader /></SearchQueryRedirect></LanguageGuard>} />
      <Route path="/:language/quran/tree/:treeSurahId/:treeVerseNum" element={<LanguageGuard><QuranSemantic /></LanguageGuard>} />
      <Route path="/:language/quran/:surahId" element={<LanguageGuard><SearchQueryRedirect buildSearchPath={getQuranSearchPath}><QuranIndex /></SearchQueryRedirect></LanguageGuard>} />
      <Route path="*" element={<LegacyRedirect targetPath="/" />} />
    </Routes>
  );
}
