export const SITE_LANGUAGE_STORAGE_KEY = 'site-language';
export const DEFAULT_SITE_LANGUAGE = 'en';

export const SITE_LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
  { value: 'he', label: 'עברית' }
];

export function isRtlLanguage(language) {
  return language === 'ar' || language === 'he';}
export function isSupportedLanguage(language) {
  return SITE_LANGUAGE_OPTIONS.some((option) => option.value === language);}
export function resolveSiteLanguage(language, fallbackLanguage = DEFAULT_SITE_LANGUAGE) {
  if (isSupportedLanguage(language)) {return language;}
  if (isSupportedLanguage(fallbackLanguage)) {return fallbackLanguage;}
  return DEFAULT_SITE_LANGUAGE;
}
export function stripLanguageFromPath(pathname) {
  const normalizedPath = String(pathname || '/').startsWith('/') ? String(pathname || '/') : `/${String(pathname || '')}`;
  const segments = normalizedPath.split('/').filter(Boolean);
  if (segments.length > 0 && isSupportedLanguage(segments[0])) {
    const rest = segments.slice(1);
    return rest.length > 0 ? `/${rest.join('/')}` : '/';
  }
  return normalizedPath || '/';
}
export function buildLocalizedPath(language, pathname = '/') {
  const resolvedLanguage = resolveSiteLanguage(language);
  const strippedPath = stripLanguageFromPath(pathname);
  return strippedPath === '/'
    ? `/${resolvedLanguage}`
    : `/${resolvedLanguage}${strippedPath}`;
}

export function getHomePath(language) {
  return buildLocalizedPath(language, '/');}
export function getBiblePath(language, bookId = '0', chapterId = '1') {
  return buildLocalizedPath(language, `/bible/${bookId}/${chapterId}`);}
const encodeTerm = (term) => encodeURIComponent(String(term || '').trim());
export function getBibleSearchPath(language, term) {
  return buildLocalizedPath(language, `/bible/search/${encodeTerm(term)}`);}

export function getQuranPath(language, surahId = '1') {
  return buildLocalizedPath(language, `/quran/${surahId}`);}
export function getQuranTreePath(language, surahId, verseNum) {
  return buildLocalizedPath(language, `/quran/tree/${surahId}/${verseNum}`);}
export function getQuranSearchPath(language, term) {
  return buildLocalizedPath(language, `/quran/search/${encodeTerm(term)}`);}

export function OntologyViewPath(language) {
  return buildLocalizedPath(language, '/quran/ontology/concepts');}
export function OntologyConceptPath(language, conceptId) {
  return buildLocalizedPath(language, `/quran/ontology/concepts/${conceptId}/view`);}

export function AdminOntologyAddPath(language) {
  return '/admin/ontology';}
export function AdminOntologyEditPath(language, conceptId) {
  return `/admin/ontology/concepts/${conceptId}`;}
export function AdminOntologyViewPath(language) {
  return '/admin/ontology/concepts';}
export function AdminOntologyConceptPath(language, conceptId) {
  return `/admin/ontology/concepts/${conceptId}/view`;}
