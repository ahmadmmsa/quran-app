import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { bibleAPI } from '../api'
import { getBiblePath, getBibleSearchPath } from '../siteLanguage'
import { useLanguage } from '../LanguageContext'
import ReaderLayout from '../components/ReaderLayout'
import ChapterSidebar from '../components/ChapterSidebar'
import SearchBar from '../components/SearchBar'
import Verse from '../components/Verse'

export default function BibleReader() {
  const { bookId = '0', chapterId = '1', term = '' } = useParams()
  const navigate = useNavigate()
  const { language, copy, isRTL } = useLanguage()

  const [books, setBooks] = useState([])
  const [verses, setVerses] = useState([])
  const [chaptersCount, setChaptersCount] = useState(0)
  const [bookInfo, setBookInfo] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [relatedTags, setRelatedTags] = useState([])

  // Initialize from CSS variable default or fallback
  const [fontSize, setFontSize] = useState(() => {
    return parseInt(localStorage.getItem('bible-font-size') || '18')
  })

  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    bibleAPI.getBooks().then(res => setBooks(res.data)).catch(console.error)
  }, [])

  useEffect(() => {
    const bid = parseInt(bookId)
    const cid = parseInt(chapterId)
    const searchTerm = String(term || '').trim()

    setLoading(true)
    setSearchResults(null)

    if (searchTerm) {
      setSearchQuery(searchTerm)
      bibleAPI.search(searchTerm)
        .then((res) => {
          setRelatedTags(res.data.related_terms || [])
          setSearchResults(res.data)
        })
        .catch(console.error)
        .finally(() => {
          setLoading(false)
          setSearching(false)
        })
    } else {
      setSearchQuery('')
      setRelatedTags([])
      Promise.all([
        bibleAPI.getBook(bid),
        bibleAPI.getChaptersCount(bid),
        bibleAPI.getVerses(bid, cid)
      ]).then(([bookRes, countRes, versesRes]) => {
        setBookInfo(bookRes.data)
        setChaptersCount(countRes.data.count)
        setVerses(versesRes.data)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }).catch(console.error).finally(() => {
        setLoading(false)
        setSearching(false)
      })
    }
  }, [bookId, chapterId, term])

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleSearch = (e) => {
    if (e && e.preventDefault) e.preventDefault()
    const trimmedQuery = searchQuery.trim()
    if (!trimmedQuery) return
    setSearching(true)
    navigate(getBibleSearchPath(language, trimmedQuery))
  }

  const getBookLabel = (book) => {
    if (!book) return ''
    if (language === 'ar') return book.name_ar || book.name
    return book.name
  }

  const getSearchBookLabel = (verse) => {
    if (language === 'ar') return verse.book_name_ar || verse.book_name
    return verse.book_name
  }

  const getTagTerm = (tag) => typeof tag === 'string' ? tag : tag?.term || ''

  const handleRelatedTagClick = (tag) => {
    const tagTerm = getTagTerm(tag)
    if (!tagTerm) return
    setSearching(true)
    navigate(getBibleSearchPath(language, tagTerm))
  }

  const bid = parseInt(bookId)
  const cid = parseInt(chapterId)
  const prevChapter = cid > 1 ? cid - 1 : null
  const nextChapter = cid < chaptersCount ? cid + 1 : null

  // Sidebar mapping
  const sidebarItems = books.map(book => ({
    id: book.id,
    label: getBookLabel(book)
  }))

  const sidebarContent = (
    <ChapterSidebar
      title={copy.books}
      items={sidebarItems}
      activeId={bid}
      onSelect={(id) => { navigate(getBiblePath(language, id, 1)); setSidebarOpen(false) }}
      onClose={() => setSidebarOpen(false)}
    />
  )

  return (
    <ReaderLayout
      sidebar={sidebarContent}
      isRtl={isRTL}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
    >
      <div className={`reader-header ${scrolled ? 'scrolled' : ''}`}>
        <div style={{ flex: 1 }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onSubmit={handleSearch}
            placeholder={copy.bibleSearchPlaceholder}
            onSidebarToggle={() => setSidebarOpen(true)}
            searching={searching}
          />
        </div>

        <div className="reader-controls" style={{ marginLeft: '1rem' }}>
          <input
            type="range"
            min="14"
            max="32"
            value={fontSize}
            onChange={(e) => {
              const size = parseInt(e.target.value)
              setFontSize(size)
              localStorage.setItem('bible-font-size', size)
            }}
            title={copy.fontSize}
            style={{ width: '80px' }}
          />
        </div>
      </div>

      {loading ? (
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
              {copy.resultsFor} "{searchQuery}"
            </h1>
            <div className="reader-subtitle" style={{ color: 'var(--color-text-muted)' }}>
              {searchResults.count} {copy.results || 'results'} found
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

          {searchResults.stopword_only ? (
            <div className="mb-4 rounded-md border px-4 py-3" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
              {copy.searchStopwordsOnly}
            </div>
          ) : searchResults.count === 0 ? (
            <div className="mb-4 rounded-md border px-4 py-3" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
              {copy.noBibleResults}
            </div>
          ) : (
            <div>
              {searchResults.results.map((verse, idx) => (
                <div key={idx} style={{ marginBottom: '2rem' }}>
                  <div
                    className="reader-subtitle mb-2"
                    style={{ cursor: 'pointer', color: 'var(--color-accent)' }}
                    onClick={() => navigate(getBiblePath(language, verse.Book, verse.Chapter))}
                  >
                    {getSearchBookLabel(verse)} - {copy.chapter} {verse.Chapter}, {copy.verse} {verse.verse_number}
                  </div>
                  <Verse
                    verseNum={null}
                    language={language}
                    textEn={verse.text}
                    textAr={verse.text_ar}
                    textHe={verse.text_he}
                    fontSize={fontSize}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="mb-5">
            <h1 className="reader-title">{getBookLabel(bookInfo)}</h1>
            <h2 className="reader-subtitle">{copy.chapter} {cid}</h2>
          </div>

          <div className="mb-4 flex flex-wrap gap-2" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <button disabled={!prevChapter} onClick={() => navigate(getBiblePath(language, bid, prevChapter))}>
              {copy.prev}
            </button>
            <div className="flex flex-nowrap gap-1 overflow-auto" style={{ maxWidth: 'calc(100% - 150px)', scrollbarWidth: 'none' }}>
              {Array.from({ length: chaptersCount }, (_, i) => i + 1).map(ch => (
                <button key={ch} 
                  style={{
                    backgroundColor: ch === cid ? 'var(--color-accent)' : 'transparent',
                    color: ch === cid ? '#fff' : 'var(--color-text-primary)'
                  }}
                  onClick={() => navigate(getBiblePath(language, bid, ch))}
                >
                  {ch}
                </button>
              ))}
            </div>
            <button disabled={!nextChapter} onClick={() => navigate(getBiblePath(language, bid, nextChapter))}>
              {copy.next}
            </button>
          </div>

          <div className="verses-list">
            {verses.map((verse, idx) => (
              <Verse
                key={idx}
                verseNum={verse.verse_number}
                language={language}
                textEn={verse.text}
                textAr={verse.text_ar}
                textHe={verse.text_he}
                fontSize={fontSize}
              />
            ))}
          </div>
        </>
      )}
    </ReaderLayout>
  )
}
