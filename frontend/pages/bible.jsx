import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { bibleAPI } from '../api'
import { getBiblePath, getBibleSearchPath } from '../siteLanguage'
import { useLanguage } from '../LanguageContext'
import { useReader } from '../ReaderContext'
import ReaderLayout from '../components/ReaderLayout'
import ChapterSidebar from '../components/ChapterSidebar'
import Verse from '../components/Verse'
import Spinner from '../components/Spinner'
import SearchResultCard from '../components/SearchResultCard'
import CopyVerseButton from '../components/CopyVerseButton'
import RelatedTags, { getTagTerm } from '../components/RelatedTags'
import useCopyVerse from '../hooks/useCopyVerse'

export default function BibleReader() {
  const { bookId = '0', chapterId = '1', term = '' } = useParams()
  const navigate = useNavigate()
  const { language, copy, isRTL } = useLanguage()

  const [books, setBooks] = useState([])
  const [verses, setVerses] = useState([])
  const [chaptersCount, setChaptersCount] = useState(0)
  const [bookInfo, setBookInfo] = useState(null)
  const [searchResults, setSearchResults] = useState(null)
  const [relatedTags, setRelatedTags] = useState([])
  const { setSidebarOpen, searchQuery, setSearchQuery } = useReader()

  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState(null)

  const getSearchBookLabel = (verse) => {
    if (language === 'ar') return verse.book_name_ar || verse.book_name
    return verse.book_name
  }

  const buildBibleCopyText = (verse) => {
    const book = getSearchBookLabel(verse)
    const ref = `${verse.Chapter}:${verse.verse_number}`
    const primary = language === 'ar'
      ? (verse.text_ar || verse.text)
      : language === 'he'
        ? (verse.text_he || verse.text)
        : (verse.text || verse.text_ar || verse.text_he)
    const lines = [`${book} ${ref}`, '']
    if (primary) lines.push(primary)
    lines.push('', `— ${book} ${ref}`)
    return lines.join('\n')
  }

  const { copiedKey, copyVerse } = useCopyVerse(buildBibleCopyText)

  useEffect(() => {
    bibleAPI.getBooks().then(res => setBooks(res.data)).catch(console.error)
  }, [])

  useEffect(() => {
    const bid = parseInt(bookId)
    const cid = parseInt(chapterId)
    const searchTerm = String(term || '').trim()

    setLoading(true)
    setSearchResults(null)
    setSearchError(null)

    if (searchTerm) {
      setSearchQuery(searchTerm)
      bibleAPI.search(searchTerm)
        .then((res) => {
          setRelatedTags(res.data.related_terms || [])
          setSearchResults(res.data)
        })
        .catch(err => {
          console.error(err)
          setSearchError(err.message || 'An error occurred during search')
        })
        .finally(() => {
          setLoading(false)
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
      })
    }
  }, [bookId, chapterId, term])

  const getBookLabel = (book) => {
    if (!book) return ''
    if (language === 'ar') return book.name_ar || book.name
    return book.name
  }

  const handleRelatedTagClick = (tag) => {
    const tagTerm = getTagTerm(tag)
    if (!tagTerm) return
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
    <ReaderLayout sidebar={sidebarContent}>

      {loading ? (
        <Spinner label={copy.loading} />
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

          <RelatedTags tags={relatedTags} onSelect={handleRelatedTagClick} />

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
              {searchResults.results.map((verse) => {
                const key = `${verse.Book}:${verse.Chapter}:${verse.verse_number}`
                return (
                  <SearchResultCard
                    key={key}
                    label={getSearchBookLabel(verse)}
                    reference={`${verse.Chapter}:${verse.verse_number}`}
                    onLabelClick={() => navigate(getBiblePath(language, verse.Book, verse.Chapter))}
                    actions={
                      <>
                        <CopyVerseButton isCopied={copiedKey === key} onClick={() => copyVerse(key, verse)} copy={copy} />
                        <button
                          type="button"
                          className="verse-action-btn verse-action-btn--accent"
                          onClick={() => navigate(getBiblePath(language, verse.Book, verse.Chapter))}
                        >
                          {copy.goToPassage || 'Go to passage'} →
                        </button>
                      </>
                    }
                  >
                    <Verse
                      verseNum={null}
                      language={language}
                      textEn={verse.text}
                      textAr={verse.text_ar}
                      textHe={verse.text_he}
                    />
                  </SearchResultCard>
                )
              })}
            </div>
          )}
        </div>
      ) : searchError ? (
        <div className="mb-4 rounded-md border px-4 py-3" style={{ backgroundColor: 'rgba(255,0,0,0.1)', borderColor: 'red', color: 'red' }}>
          Error: {searchError}
        </div>
      ) : !term ? (
        <>
          <div className="surah-header">
            <div className="surah-header-eyebrow">{copy.chapter} {cid} · {verses.length} {copy.verses || 'Verses'}</div>
            <h1 className={`surah-header-name ${language === 'ar' ? 'surah-header-name--ar' : ''}`}>{getBookLabel(bookInfo)}</h1>
          </div>

          <div className="chapter-pager" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <button type="button" className="chapter-pager-nav" disabled={!prevChapter} onClick={() => navigate(getBiblePath(language, bid, prevChapter))}>
              ‹ {copy.prev}
            </button>
            <div className="chapter-pager-list">
              {Array.from({ length: chaptersCount }, (_, i) => i + 1).map(ch => (
                <button
                  key={ch}
                  type="button"
                  className={`chapter-chip ${ch === cid ? 'active' : ''}`}
                  onClick={() => navigate(getBiblePath(language, bid, ch))}
                >
                  {ch}
                </button>
              ))}
            </div>
            <button type="button" className="chapter-pager-nav" disabled={!nextChapter} onClick={() => navigate(getBiblePath(language, bid, nextChapter))}>
              {copy.next} ›
            </button>
          </div>

          <div className="verses-list">
            {verses.map((verse) => (
              <Verse
                key={verse.verse_number}
                verseNum={verse.verse_number}
                language={language}
                textEn={verse.text}
                textAr={verse.text_ar}
                textHe={verse.text_he}
              />
            ))}
          </div>
        </>
      ) : null}
    </ReaderLayout>
  )
}
