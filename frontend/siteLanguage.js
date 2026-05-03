export const SITE_LANGUAGE_STORAGE_KEY = 'site-language';
export const DEFAULT_SITE_LANGUAGE = 'en';

export const SITE_LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
  { value: 'he', label: 'עברית' }
];

export const COPY = {
  ar: {
    themeDarkMode: 'داكن',
    themeLightMode: 'فاتح',
    brand: 'ملة إبراهيم',
    bible: 'التوراة والإنجيل',
    quran: 'القرآن',
    Ontology: 'المفاهيم',
    OntologySubtitle: 'إدارة وتحليل المفاهيم القرآنية',
    OntologyUnavailable: 'تعذر تحميل المفاهيم المحفوظة',
    OntologyLoading: 'جاري تحميل المفاهيم…',
    OntologyNotfound: 'لا توجد مفاهيم محفوظة بعد. ابدأ بإنشاء مفهوم جديد.',
    OntologyVerses: 'عدد الآيات:',
    OntologyAddNewConcept: 'إضافة مفهوم جديد',
    OntologyConceptLabel: 'العنوان',
    OntologySeedTerms: 'كلمات البحث',
    and: 'و',
    or: 'أو',
    addTerm: 'أضف كلمة',
    language: 'اللغة',
    welcomeTitle: 'مرحبًا بك في الكتب السماوية',
    welcomeSubtitle: 'اختر النص الذي تريد استكشافه:',
    books: 'الأسفار',
    verses: 'الآيات',
    terms: 'المفاهيم',
    surahs: 'السور',
    search: 'بحث',
    searching: 'جاري البحث ...',
    clear: 'مسح',
    selected: 'مختارة',
    edit: 'تعديل',
    delete: 'حذف',
    deleting: 'جاري الحذف ...',
    updated: 'تم التحديث',
    updateError: 'حدث خطأ أثناء الحفظ. يرجى المحاولة مرة أخرى.',
    save: 'حفظ',
    saving: 'جاري الحفظ ...',
    selectAll: 'تحديد الكل',
    selectNone: 'الغاء التحديد',
    view: 'عرض',
    loading: 'جاري التحميل…',
    noBibleResults: 'لا توجد آيات مطابقة.',
    noQuranResults: 'لا توجد نتائج.',
    font: 'الخط',
    fontSize: 'حجم الخط',
    chapter: 'الإصحاح',
    prev: 'السابق',
    next: 'التالي',
    verse: 'آية',
    tafseer: 'التفسير',
    relatedVerses: 'استكشاف دلالي',
    relatedVersesLoading: 'جارٍ الاستكشاف الدلالي…',
    relatedVersesUnavailable: 'لم يتم العثور على آيات مرتبطة دلاليًا.',
    relatedVersesError: 'تعذر تنفيذ الاستكشاف الدلالي.',
    keyTerms: 'الكلمات المفتاحية',
    matchedTerms: 'الكلمات المطابقة',
    close: 'إغلاق',
    backToTop: 'العودة إلى الأعلى',
    bibleSearchPlaceholder: 'ابحث في الكتاب المقدس...',
    quranSearchPlaceholder: 'ابحث في القرآن…',
    results: 'النتائج',
    resultsFor: 'نتائج البحث عن',
    tafseerLoading: 'جاري تحميل التفسير…',
    tafseerUnavailable: 'لا يوجد تفسير متاح',
    tafseerError: 'حدث خطأ في تحميل التفسير',
    booksMenu: 'قائمة الأسفار',
    surahsMenu: 'قائمة السور',
    goToVerse: 'الذهاب إلى الآية',
    searchStopwordsOnly: 'بحثك يحتوي فقط على كلمات شائعة. يرجى استخدام كلمات أكثر تحديدًا.'
  },
  en: {
    themeDarkMode: 'Dark mode',
    themeLightMode: 'Light mode',
    brand: 'Abrahamic Scriptures',
    bible: 'Bible',
    quran: 'Quran',
    Ontology: 'Quran Ontology',
    OntologySubtitle: 'Manage and explore Quranic concepts',
    OntologyUnavailable: 'Unable to load saved concepts.',
    OntologyLoading: 'Loading concepts...',
    OntologyNotfound: 'No saved concepts yet. Start by creating a new concept.',
    OntologyVerses: 'Verses:',
    OntologyConceptLabel: 'Concept label',
    OntologySeedTerms: 'Seed terms',
    OntologyAddNewConcept: 'Add new concept',
    and: 'And',
    or: 'Or',
    addTerm: 'Add term',
    language: 'Language',
    welcomeTitle: 'Welcome to Abrahamic Scriptures',
    welcomeSubtitle: 'Choose a scripture to explore:',
    books: 'Books',
    surahs: 'Surahs',
    verses: 'Verses',
    terms: 'Terms',
    search: 'Search',
    searching: 'Searching...',
    clear: 'Clear',
    selected: 'Selected',
    edit: 'Edit',
    delete: 'Delete',
    deleting: 'Deleting...',
    updated: 'Updated',
    updateError: 'An error occurred while saving. Please try again.',
    save: 'Save',
    saving: 'Saving...',
    selectAll: 'Select all',
    selectNone: 'Select none',
    view: 'View',
    loading: 'Loading...',
    noBibleResults: 'No verses found.',
    noQuranResults: 'No results.',
    font: 'Font',
    fontSize: 'Font size',
    chapter: 'Chapter',
    prev: 'Prev',
    next: 'Next',
    save: 'Save',
    saving: 'Saving...',
    verse: 'Verse',
    tafseer: 'Tafseer',
    relatedVerses: 'Semantic exploration',
    relatedVersesLoading: 'Running semantic exploration...',
    relatedVersesUnavailable: 'No semantically related verses found.',
    relatedVersesError: 'Unable to run semantic exploration.',
    keyTerms: 'Key terms',
    matchedTerms: 'Matched terms',
    close: 'Close',
    backToTop: 'Back to top',
    bibleSearchPlaceholder: 'Search verses...',
    quranSearchPlaceholder: 'Search the Quran...',
    results: 'Results',
    resultsFor: 'Results for',
    tafseerLoading: 'Loading tafseer...',
    tafseerUnavailable: 'No tafseer available.',
    tafseerError: 'Unable to load tafseer.',
    booksMenu: 'Books menu',
    surahsMenu: 'Surahs menu',
    goToVerse: 'Go to verse',
    searchStopwordsOnly: 'Your search contains only common words. Please use more specific terms.'
  },

  he: {
    themeDarkMode: 'מצב כהה',
    themeLightMode: 'מצב בהיר',
    brand: 'אברהמי',
    bible: 'כתבי הקודש',
    quran: 'קוראן',
    Ontology: 'אונטולוגיית הקוראן',
    OntologyConceptLabel: 'אונטולוגיית הקוראן',
    OntologySeedTerms: 'אונטולוגיית הקוראן',
    OntologyAddNewConcept: 'אונטולוגיית הקוראן',
    addTerm: 'הוסף מילה',
    and: 'ו',
    or: 'או',
    language: 'שפה',
    welcomeTitle: 'ברוכים הבאים לכתבים האברהמיים',
    welcomeSubtitle: 'בחרו טקסט לעיון:',
    books: 'ספרים',
    surahs: 'סורות',
    verses: 'פסוקים',
    terms: 'מונחים',
    delete: 'מחק',
    deleting: 'מוחק...',
    updated: 'تم التحديث',
    updateError: 'حدث خطأ أثناء الحفظ. يرجى المحاولة مرة أخرى.',
    search: 'חיפוש',
    searching: 'מחפש...',
    clear: 'נקה',
    loading: 'טוען...',
    noBibleResults: 'לא נמצאו פסוקים.',
    noQuranResults: 'לא נמצאו תוצאות.',
    font: 'גופן',
    fontSize: 'גודל גופן',
    chapter: 'פרק',
    prev: 'הקודם',
    next: 'הבא',
    verse: 'פסוק',
    tafseer: 'תפסיר',
    relatedVerses: 'פסוקים קשורים',
    relatedVersesLoading: 'מאתר פסוקים דומים...',
    relatedVersesUnavailable: 'לא נמצאו פסוקים קרובים בנושא.',
    relatedVersesError: 'לא ניתן לטעון פסוקים קשורים.',
    keyTerms: 'מונחי מפתח',
    matchedTerms: 'מונחים תואמים',
    close: 'סגור',
    backToTop: 'חזרה למעלה',
    bibleSearchPlaceholder: 'חיפוש בפסוקים...',
    quranSearchPlaceholder: 'חיפוש בקוראן...',
    results: 'תוצאות',
    resultsFor: 'תוצאות עבור',
    tafseerLoading: 'טוען תפסיר...',
    tafseerUnavailable: 'אין תפסיר זמין.',
    tafseerError: 'לא ניתן לטעון את התפסיר.',
    booksMenu: 'תפריט ספרים',
    surahsMenu: 'תפריט סורות',
    goToVerse: 'מעבר לפסוק',
    searchStopwordsOnly: 'החיפוש שלך מכיל רק מילות תפקוד נפוצות. נא להשתמש במונחים ספציפיים יותר.'
  }
};

Object.assign(COPY.he, {
  OntologySubtitle: 'Concept management',
  OntologyUnavailable: 'Unable to load saved concepts.',
  OntologyLoading: 'Loading concepts...',
  OntologyNotfound: 'No saved concepts yet. Start by creating a new concept.',
  OntologyVerses: 'Verses:',
  selected: 'Selected',
  edit: 'Edit',
  save: 'Save',
  saving: 'Saving...',
  selectAll: 'Select all',
  selectNone: 'Select none',
  view: 'View'
});

export function getLanguageCopy(language) {
  return COPY[language] || COPY.en;
}

export function isRtlLanguage(language) {
  return language === 'ar' || language === 'he';
}

export function isSupportedLanguage(language) {
  return SITE_LANGUAGE_OPTIONS.some((option) => option.value === language);
}

export function resolveSiteLanguage(language, fallbackLanguage = DEFAULT_SITE_LANGUAGE) {
  if (isSupportedLanguage(language)) {
    return language;
  }

  if (isSupportedLanguage(fallbackLanguage)) {
    return fallbackLanguage;
  }

  return DEFAULT_SITE_LANGUAGE;
}

export function stripLanguageFromPath(pathname) {
  const normalizedPath = String(pathname || '/').startsWith('/')
    ? String(pathname || '/')
    : `/${String(pathname || '')}`;
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
  return buildLocalizedPath(language, '/');
}

export function getBiblePath(language, bookId = '0', chapterId = '1') {
  return buildLocalizedPath(language, `/bible/${bookId}/${chapterId}`);
}

export function getBibleSearchPath(language, term) {
  return buildLocalizedPath(language, `/bible/search/${encodeURIComponent(String(term || '').trim())}`);
}

export function getQuranPath(language, surahId = '1') {
  return buildLocalizedPath(language, `/quran/${surahId}`);
}

export function getOntologyAddPath(language) {
  return buildLocalizedPath(language, '/quran/ontology');
}

export function getOntologyViewPath(language) {
  return buildLocalizedPath(language, '/quran/ontology/concepts');
}

export function getOntologyEditPath(language, conceptId) {
  return buildLocalizedPath(language, `/quran/ontology/concepts/${conceptId}`);
}

export function getOntologyConceptViewPath(language, conceptId) {
  return buildLocalizedPath(language, `/quran/ontology/concepts/${conceptId}/view`);
}

export function getQuranTreePath(language, surahId, verseNum) {
  return buildLocalizedPath(language, `/quran/tree/${surahId}/${verseNum}`);
}

export function getQuranSearchPath(language, term) {
  return buildLocalizedPath(language, `/quran/search/${encodeURIComponent(String(term || '').trim())}`);
}
