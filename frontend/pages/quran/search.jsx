import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { quranAPI } from '../../api'
import { getQuranPath, getQuranTreePath, getQuranSearchPath } from '../../siteLanguage'
import { useLanguage } from '../../LanguageContext'
import { useReader } from '../../ReaderContext'
import {
  getVerseSurahId,
  getVerseNumberValue,
  getVerseSurahLabel,
  getVerseText,
  getSurahLabel
} from './shared'
import ReaderLayout from '../../components/ReaderLayout'
import Verse from '../../components/Verse'
import ChapterSidebar from '../../components/ChapterSidebar'

const PER_PAGE_OPTIONS = [10, 20, 50, 100]

export default function QuranSearch() {
  const { term: routeTerm } = useParams()
  const navigate = useNavigate()
  const { language, copy } = useLanguage()

  const [surahs, setSurahs] = useState([])
  const [searchResults, setSearchResults] = useState(null)
  const [relatedTags, setRelatedTags] = useState([])
  const [searching, setSearching] = useState(false)

  // Independent pagination state per section.
  const [literalPage, setLiteralPage] = useState(1)
  const [literalPerPage, setLiteralPerPage] = useState(20)
  const [expansionPage, setExpansionPage] = useState(1)
  const [expansionPerPage, setExpansionPerPage] = useState(20)

  const { fontSize, setSearchQuery, setSidebarOpen } = useReader()

  useEffect(() => {
    quranAPI.getSurahs().then((res) => setSurahs(Array.isArray(res.data) ? res.data : [])).catch(console.error)
  }, [])

  // Reset each section to its first page when the term or that section's size changes.
  useEffect(() => { setLiteralPage(1); setExpansionPage(1) }, [routeTerm])
  useEffect(() => { setLiteralPage(1) }, [literalPerPage])
  useEffect(() => { setExpansionPage(1) }, [expansionPerPage])

  useEffect(() => {
    const searchTerm = String(routeTerm || '').trim()
    setSearchQuery(searchTerm)

    if (!searchTerm) {
      setSearchResults(null)
      return
    }

    let ignore = false
    setSearching(true)
    quranAPI.search(searchTerm, { literalPage, literalPerPage, expansionPage, expansionPerPage })
      .then((res) => {
        if (ignore) return
        setRelatedTags(res.data.related_terms || [])
        setSearchResults(res.data)
      })
      .catch((err) => { if (!ignore) console.error(err) })
      .finally(() => { if (!ignore) setSearching(false) })

    return () => { ignore = true }
  }, [routeTerm, literalPage, literalPerPage, expansionPage, expansionPerPage, setSearchQuery])

  const handleVerseClick = (verse, overrideSurahId) => {
    const sourceSurahId = getVerseSurahId(verse, overrideSurahId)
    const sourceVerseNum = getVerseNumberValue(verse)
    if (!sourceSurahId || !sourceVerseNum) return
    navigate(getQuranTreePath(language, sourceSurahId, sourceVerseNum))
  }

  const getTagTerm = (tag) => typeof tag === 'string' ? tag : tag?.term || ''
  const handleRelatedTagClick = (tag) => {
    const tagTerm = getTagTerm(tag)
    if (tagTerm) navigate(getQuranSearchPath(language, tagTerm))
  }

  const goToPage = (group, next) => {
    if (group === 'literal') setLiteralPage(next)
    else setExpansionPage(next)
    document.getElementById(`search-section-${group}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const sidebarItems = (Array.isArray(surahs) ? surahs : []).map(surah => ({
    id: surah.suraid,
    label: getSurahLabel(surah, language)
  }))

  const sidebarContent = (
    <ChapterSidebar
      title={copy.surahs}
      items={sidebarItems}
      activeId={null}
      onSelect={(id) => { navigate(getQuranPath(language, id)); setSidebarOpen(false) }}
      onClose={() => setSidebarOpen(false)}
    />
  )

  const pageLabel = (page, total) => (copy.pageOf || 'Page {page} of {total}')
    .replace('{page}', page).replace('{total}', total)

  const renderVerseCard = (verse, idx) => {
    const textAr = language === 'ar' ? getVerseText(verse, 'ar') : null
    const textEn = language === 'en' ? getVerseText(verse, 'en') : null
    return (
      <div key={`${verse.suranum}:${verse.versenum}:${idx}`} style={{ marginBottom: '2rem' }}>
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
        <Verse verseNum={verse.versenum} language={language} textEn={textEn} textAr={textAr} textHe={null} fontSize={fontSize} />
      </div>
    )
  }

  const renderSection = (group, block, perPage, setPerPage) => {
    if (!block) return null
    const isLiteral = group === 'literal'
    const heading = isLiteral
      ? { label: copy.exactMatches || 'Exact matches', hint: copy.exactMatchesHint || 'Verses that contain this word' }
      : { label: copy.relatedByRootLemma || 'Related by root & lemma', hint: copy.relatedByRootLemmaHint || 'Same root or word family — broader, not exact' }
    const showPagination = perPage > 0 && block.total_pages > 1

    const controlBarStyle = {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem',
    }

    return (
      <section id={`search-section-${group}`} style={{ marginTop: isLiteral ? 0 : '2.5rem' }}>
        <div style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--color-text-primary)' }}>{heading.label}</span>
            <span className="text-muted text-sm">{block.count}</span>
          </div>
          <div className="text-muted text-sm">{heading.hint}</div>
        </div>

        {block.count === 0 ? (
          <div className="text-muted text-sm" style={{ marginBottom: '1rem' }}>
            {copy.noQuranResults || 'No results.'}
          </div>
        ) : (
          <>
            <div style={controlBarStyle}>
              <label className="text-muted text-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {copy.resultsPerPage || 'Results per page'}
                <select
                  value={perPage}
                  onChange={(e) => setPerPage(Number(e.target.value))}
                  style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
                >
                  {PER_PAGE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  <option value={0}>{copy.showAll || 'All'}</option>
                </select>
              </label>
              {showPagination && (
                <span className="text-muted text-sm">{pageLabel(block.page, block.total_pages)}</span>
              )}
            </div>

            {block.results.map(renderVerseCard)}

            {showPagination && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button disabled={block.page <= 1} onClick={() => goToPage(group, block.page - 1)} style={{ padding: '6px 14px', opacity: block.page <= 1 ? 0.5 : 1 }}>
                  {copy.previous || 'Previous'}
                </button>
                <span className="text-muted text-sm">{pageLabel(block.page, block.total_pages)}</span>
                <button disabled={block.page >= block.total_pages} onClick={() => goToPage(group, block.page + 1)} style={{ padding: '6px 14px', opacity: block.page >= block.total_pages ? 0.5 : 1 }}>
                  {copy.next || 'Next'}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    )
  }

  const total = searchResults?.count ?? 0
  const literal = searchResults?.literal
  const expansion = searchResults?.expansion

  return (
    <ReaderLayout sidebar={sidebarContent}>
      {searching && !searchResults ? (
        <div className="global-spinner-wrapper flex flex-col gap-3">
          <svg className="global-spinner" viewBox="0 0 50 50">
            <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="4"></circle>
          </svg>
          <div className="text-muted" style={{ fontFamily: 'var(--font-serif)' }}>{copy.loading}</div>
        </div>
      ) : searchResults !== null ? (
        <div>
          <div className="mb-4">
            <h1 className="reader-title mb-1">
              {copy.resultsFor || copy.results} "{routeTerm}"
            </h1>
            <div className="reader-subtitle" style={{ color: 'var(--color-text-muted)' }}>
              {total} {copy.verse}
              {total > 0 && (
                <span className="text-muted text-sm">
                  {' '}· {literal?.count ?? 0} {copy.exactMatches || 'exact'} / {expansion?.count ?? 0} {copy.relatedByRootLemma || 'related'}
                </span>
              )}
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
          ) : total === 0 ? (
            <div className="mb-4 rounded-md border px-4 py-3" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
              {copy.noQuranResults}
            </div>
          ) : (
            <div>
              {renderSection('literal', literal, literalPerPage, setLiteralPerPage)}
              {renderSection('expansion', expansion, expansionPerPage, setExpansionPerPage)}
            </div>
          )}
        </div>
      ) : null}
    </ReaderLayout>
  )
}
