import { Link, useNavigate, useLocation } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import ScrollManager from './components/ScrollManager';
import { LanguageProvider, useLanguage } from './LanguageContext';
import { ThemeProvider, useTheme } from './ThemeContext';
import { getHomePath, getQuranPath, getBiblePath, OntologyViewPath, getBibleSearchPath, getQuranSearchPath, isSupportedLanguage, SITE_LANGUAGE_OPTIONS } from './siteLanguage';
import { ReaderProvider, useReader } from './ReaderContext';
import SearchBar from './components/SearchBar';
import { AuthProvider, useAuth } from './AuthContext';
import { GoogleOAuthProvider } from '@react-oauth/google';

function AppContent() {
  const { language, setLanguage, copy, isRTL } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { sidebarOpen, setSidebarOpen, searchQuery, setSearchQuery, fontSize, setFontSize } = useReader();
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);
  const sectionSegment = isSupportedLanguage(segments[0]) ? segments[1] : segments[0];
  const isBibleRoute = sectionSegment === 'bible';
  const isQuranRoute = sectionSegment === 'quran';

  const handleLanguageChange = (event) => setLanguage(event.target.value);
  const handleSearchSubmit = (e) => {
    e?.preventDefault?.();
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;
    navigate(isBibleRoute ? getBibleSearchPath(language, trimmedQuery) : getQuranSearchPath(language, trimmedQuery));
  };

  const headerLinkStyle = { color: 'white', textDecoration: 'none', fontWeight: 'bold' };

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
            {isQuranRoute && <Link to={OntologyViewPath(language)}>{copy.Ontology}</Link>}
          </div>
          
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link to="/admin" style={headerLinkStyle}>{copy.AdminPanel}</Link>
                <button onClick={logout} style={{ color: 'white', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>{copy.Logout}</button>
              </>
            ) : (
              <Link to="/admin/login" style={headerLinkStyle}>{copy.Login}</Link>
            )}
            <button className="theme-toggle" onClick={toggleTheme} aria-label={copy.toggleTheme || "Toggle theme"}>
              {theme === 'light' ? copy.themeDarkMode : copy.themeLightMode}
            </button>
            <select className="lang-toggle" value={language} onChange={handleLanguageChange} aria-label={copy.language}>
              {SITE_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

{(isBibleRoute || isQuranRoute) && 
      <div className="reader-global-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', maxWidth: '1152px', margin: '0 auto', padding: '0.5rem 1rem' }}>
          <button 
            className="sidebar-toggle-open" 
            onClick={() => setSidebarOpen(prev => !prev)} 
            aria-label={copy.toggleMenu || "Toggle menu"}
          >
            ☰
          </button>
          <div className="w-full search-bar">
            <SearchBar className="flex items-center justify-center gap-2"
              value={searchQuery}
              onChange={setSearchQuery}
              onSubmit={handleSearchSubmit}
              placeholder={isBibleRoute ? (copy.bibleSearchPlaceholder || 'Search Bible...') : (copy.quranSearchPlaceholder || 'Search Quran...')}
              isRtl={isRTL}
            />
          </div>

          <div className="reader-controls">
            <input
              type="range"
              min="16"
              max="56"
              defaultValue={fontSize}
              onChange={(e) => {
                document.documentElement.style.setProperty('--reader-font-size', `${e.target.value}px`);
              }}
              onPointerUp={(e) => setFontSize(parseInt(e.target.value))}
              onTouchEnd={(e) => setFontSize(parseInt(e.target.value))}
              title={copy.fontSize}
              style={{ width: '80px' }}
            />
          </div>
        </div>
      </div>
}
      <ScrollManager />

      <main>
        <AppRoutes />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || 'placeholder'}>
      <AuthProvider>
        <LanguageProvider>
          <ThemeProvider>
            <ReaderProvider>
              <AppContent />
            </ReaderProvider>
          </ThemeProvider>
        </LanguageProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
