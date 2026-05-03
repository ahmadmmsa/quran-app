import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getQuranSearchPath, getQuranPath, getHomePath } from '../../siteLanguage'

export function QuranSearchForm({ language, copy, isRtl, initialSearchQuery = '', searching = false, onSidebarToggle }) {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const navigate = useNavigate()

  useEffect(() => {
    setSearchQuery(initialSearchQuery)
  }, [initialSearchQuery])

  const handleSearch = (e) => {
    e.preventDefault()
    const trimmedQuery = searchQuery.trim()
    if (!trimmedQuery) return
    navigate(getQuranSearchPath(language, trimmedQuery))
  }

  return (
    <form onSubmit={handleSearch} className="mb-4 w-full">
      <div className={`flex flex-wrap items-start gap-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
        {onSidebarToggle && (
          <button
            className="quran-hamburger flex md:hidden"
            onClick={onSidebarToggle}
            aria-label={copy.surahsMenu}
            type="button"
          >
            <span /><span /><span />
          </button>
        )}
        <input
          type="text"
          dir={isRtl ? 'rtl' : 'ltr'}
          placeholder={copy.quranSearchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="min-w-[220px] flex-[1_1_280px] rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-[var(--color-text-primary)] outline-none"
          style={{ minWidth: '220px', flex: '1 1 280px' }}
        />
        <button className="search-button rounded-md bg-[var(--color-accent)] px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={searching}>
          {searching ? copy.loading : copy.search}
        </button>
      </div>
    </form>
  )
}

export function QuranBreadcrumb({ language, copy, activeView }) {
  return (
    <nav className="mb-3" aria-label="breadcrumb">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <li><Link to={getHomePath(language)}>{copy.brand || 'Home'}</Link></li>
        <li>/</li>
        <li><Link to={getQuranPath(language)}>{copy.quran || 'Quran'}</Link></li>
        {activeView && (
          <>
            <li>/</li>
            <li aria-current="page">{activeView}</li>
          </>
        )}
      </ol>
    </nav>
  )
}

const ARABIC_NUMS = '٠١٢٣٤٥٦٧٨٩';

export const toArabicIndic = (num) => String(num ?? "").replace(/\d/g, d => ARABIC_NUMS[d]);
export const formatVerseNumber = (num, language) => language === 'ar' ? toArabicIndic(num) : String(num ?? '')

export const getSurahLabel = (surah, language) => {
  if (!surah) return ''
  if (language === 'ar') return surah.name_ar || surah.name_en || surah.name_he || ''
  if (language === 'he') return surah.name_he || surah.name_en || surah.name_ar || ''
  return surah.name_en || surah.name_ar || surah.name_he || ''
}

export const getVerseSurahId = (verse, overrideSurahId, fallbackSurahId) => overrideSurahId ?? verse?.suraid ?? verse?.suranum ?? parseInt(fallbackSurahId)
export const getVerseNumberValue = (verse) => verse?.verse_num ?? verse?.versenum ?? ''
export const getVerseSurahLabel = (verse, surahs, language, fallbackSurahId) => {
  if (!verse) return ''
  const verseSurahId = getVerseSurahId(verse, null, fallbackSurahId)
  const surah = surahs.find((item) => item.suraid === Number(verseSurahId))
  return getSurahLabel(surah, language)
}

const getArabicVerseText = (verse) => {
  if (!verse) return ''
  return verse.verse_txt || verse.verse_txt_raw || verse.verse_txt_en || verse.verse_txt_he || ''
}

export const getVerseText = (verse, language) => {
  if (!verse) return ''
  if (language === 'ar') return getArabicVerseText(verse)
  if (language === 'he') return verse.verse_txt_he || verse.verse_txt_en || verse.verse_txt || ''
  return verse.verse_txt_en || verse.verse_txt || verse.verse_txt_he || ''
}

export const renderVerseText = (verse, language, options = {}) => {
  const { className = '', fontSizePx = 28 } = options
  const bodyClassName = ['quran-verse-body', `quran-verse-body--${language}`, className].filter(Boolean).join(' ')

  return (
    <div className={bodyClassName} style={{ fontSize: `${fontSizePx}px` }}>
      <span className={`quran-verse-text quran-verse-text--${language}`}>{getVerseText(verse, language)}</span>
    </div>
  )
}

const BASMALA_PREFIXES = [
  'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
  'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
  'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
  'بسم الله الرحمن الرحيم'
]

export const getArabicBasmalaParts = (verse, language) => {
  if (language !== 'ar') return null
  if (Number(getVerseNumberValue(verse)) !== 1) return null

  const fullText = getArabicVerseText(verse).trim()
  const basmala = BASMALA_PREFIXES.find((prefix) => fullText.startsWith(prefix))

  if (!basmala) {
    return null
  }

  return {
    basmala,
    remainder: fullText.slice(basmala.length).trim()
  }
}
