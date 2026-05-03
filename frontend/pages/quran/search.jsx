import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { quranAPI } from '../../api'
import { getQuranPath, getQuranTreePath, getQuranSearchPath } from '../../siteLanguage'
import { useLanguage } from '../../LanguageContext'
import {
  getVerseSurahId,
  getVerseNumberValue,
  getVerseSurahLabel,
  formatVerseNumber,
  getVerseText
} from './shared'
import ReaderLayout from '../../components/ReaderLayout'
import SearchBar from '../../components/SearchBar'
import Verse from '../../components/Verse'
import ChapterSidebar from '../../components/ChapterSidebar'

export default function QuranSearch() {
  const { term: routeTerm } = useParams()
  const navigate = useNavigate()
  const { language, copy, isRTL } = useLanguage()
  const isRtl = isRTL

  const [surahs, setSurahs] = useState([])
  const [searchResults, setSearchResults] = useState(null)
  const [relatedTags, setRelatedTags] = useState([])
  const [searching, setSearching] = useState(false)
  const [fontSize, setFontSize] = useState(() => {
    return parseInt(localStorage.getItem('quran-font-size') || '28')
  })

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState(routeTerm || '')
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    quranAPI.getSurahs().then((res) => setSurahs(res.data)).catch(console.error)
  }, [])

  useEffect(() => {
    const searchTerm = String(routeTerm || '').trim()
    setSearchQuery(searchTerm)
    setSearchResults(null)

    if (searchTerm) {
      setSearching(true)
      quranAPI.search(searchTerm)
        .then((res) => {
          setRelatedTags(res.data.related_terms || [])
          setSearchResults(res.data)
        })
        .catch(console.error)
        .finally(() => {
          setSearching(false)
        })
    }
  }, [routeTerm])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleVerseClick = (verse, overrideSurahId) => {
    const sourceSurahId = getVerseSurahId(verse, overrideSurahId)
    const sourceVerseNum = getVerseNumberValue(verse)
    if (!sourceSurahId || !sourceVerseNum) return
    navigate(getQuranTreePath(language, sourceSurahId, sourceVerseNum))
  }

  const getTagTerm = (tag) => typeof tag === 'string' ? tag : tag?.term || ''

  const handleRelatedTagClick = (tag) => {
    const tagTerm = getTagTerm(tag)
    if (!tagTerm) return
    navigate(getQuranSearchPath(language, tagTerm))
  }

  const handleSearchSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault()
    const trimmedQuery = searchQuery.trim()
    if (!trimmedQuery) return
    navigate(getQuranSearchPath(language, trimmedQuery))
  }

  const sidebarItems = surahs.map(surah => ({
    id: surah.suraid,
    label: getVerseSurahLabel(null, surahs, language, surah.suraid)
  }))

  const sidebarContent = (
    <ChapterSidebar
      title={copy.surahs}
      items={sidebarItems}
      activeId={null} // No active surah in search view globally
      onSelect={(id) => { navigate(getQuranPath(language, id)); setSidebarOpen(false) }}
      onClose={() => setSidebarOpen(false)}
    />
  )

  return (
    <ReaderLayout
      sidebar={sidebarContent}
      isRtl={isRtl}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
    >
      <div className={`reader-header ${scrolled ? 'scrolled' : ''}`}>
        <div style={{ flex: 1 }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onSubmit={handleSearchSubmit}
            placeholder={copy.quranSearchPlaceholder || 'Search Quran...'}
            isRtl={isRtl}
            onSidebarToggle={() => setSidebarOpen(true)}
            searching={searching}
          />
        </div>

        <div className="reader-controls" style={{ marginLeft: '1rem' }}>
          <input
            type="range"
            min="16"
            max="56"
            value={fontSize}
            onChange={(e) => {
              const size = parseInt(e.target.value)
              setFontSize(size)
              localStorage.setItem('quran-font-size', size)
            }}
            title={copy.fontSize}
            style={{ width: '80px' }}
          />
        </div>
      </div>

      {searching && !searchResults ? (
        <div className="global-spinner-wrapper flex flex-col gap-3">
          <svg className="global-spinner" viewBox="0 0 50 50">
            <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="4"></circle>
          </svg>
          <div className="text-muted" style={{ fontFamily: 'var(--font-serif)' }}>{copy.loading}</div>
        </div>
      ) : searchResults !== null ? (
        <div>
          <div className="mb-5">
            <h1 className="reader-title mb-1">
              {copy.resultsFor || copy.results} "{routeTerm}"
            </h1>
            <div className="reader-subtitle" style={{ color: 'var(--color-text-muted)' }}>
              {copy.results || 'results'} {searchResults.count} {copy.verse}
            </div>
          </div>

          {relatedTags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {relatedTags.map((tag) => (
                <button key={getTagTerm(tag)} type="button" onClick={() => handleRelatedTagClick(tag)}>
                  {getTagTerm(tag)}
                  {typeof tag === 'object' && typeof tag?.count === 'number' && (
                    <span className="ms-2 text-muted text-sm">{tag.count}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {searchResults.search_info?.stopword_only ? (
            <div className="mb-4 rounded-md border px-4 py-3" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
              {copy.searchStopwordsOnly}
            </div>
          ) : searchResults.count === 0 ? (
            <div className="mb-4 rounded-md border px-4 py-3" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
              {copy.noQuranResults}
            </div>
          ) : (
            <div>
              {searchResults.results.map((verse, idx) => {
                const textAr = language === 'ar' ? getVerseText(verse, 'ar') : null
                const textEn = language === 'en' ? getVerseText(verse, 'en') : null

                return (
                  <div key={idx} style={{ marginBottom: '2rem' }}>
                    <div className="mb-2 flex justify-between">
                      <div
                        className="reader-subtitle"
                        style={{ cursor: 'pointer', color: 'var(--color-accent)' }}
                        onClick={() => navigate(`${getQuranPath(language, verse.suranum)}#verse-${verse.versenum}`)}
                      >
                        {getVerseSurahLabel(verse, surahs, language)}
                      </div>
                      <button style={{ fontSize: '0.85rem', padding: '4px 8px' }} onClick={() => handleVerseClick(verse, verse.suranum)}>
                        {copy.relatedVerses || 'Tree'}
                      </button>
                    </div>
                    <Verse
                      verseNum={verse.versenum}
                      language={language}
                      textEn={textEn}
                      textAr={textAr}
                      textHe={null}
                      fontSize={fontSize}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : null}
    </ReaderLayout>
  )
}
