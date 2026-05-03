import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { quranAPI } from '../../api'
import { getOntologyEditPath,getOntologyViewPath, getQuranPath } from '../../siteLanguage'
import { useLanguage } from '../../LanguageContext'
import { formatVerseNumber } from '../quran/shared'
import ReaderLayout from '../../components/ReaderLayout'
import ConceptSidebar from '../../components/ConceptSidebar'
import Verse from '../../components/Verse'

function normalizeVerse(verse) {
  const surah = Number(verse?.suraid ?? verse?.surah ?? 0)
  const verseNum = Number(verse?.verse_num ?? verse?.verse ?? 0)

  return {
    ...verse,
    _surah: surah,
    _verse: verseNum,
    _text: verse?.verse_txt_raw || verse?.verse_txt || verse?.verse_txt_en || verse?.verse_txt_he || '',
    _sourceTerms: verse?.source_terms || []
  }
}

export default function OntologyConceptViewPage() {
  const { conceptId } = useParams()
  const { language, copy, isRTL } = useLanguage()
  const isRtl = isRTL
  const [concept, setConcept] = useState(null)
  const [surahs, setSurahs] = useState([])
  const [fontSize, setFontSize] = useState(() => {
    return parseInt(localStorage.getItem('quran-font-size') || '28')
  })
  const [activeFilters, setActiveFilters] = useState([])
  const [filterMode, setFilterMode] = useState('and')
  const [viewMode, setViewMode] = useState('grid')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    quranAPI.getSurahs()
      .then((response) => setSurahs(response.data || []))
      .catch(() => { })
  }, [])

  useEffect(() => {
    quranAPI.getOntologyConcept(conceptId)
      .then((response) => {
        setConcept(response.data)
      })
      .catch((requestError) => {
        setError(requestError?.response?.data?.detail || (isRtl ? 'تعذر تحميل المفهوم.' : 'Could not load concept.'))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [conceptId, isRtl])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const getSurahLabel = (surahId) => {
    const surah = surahs.find((item) => Number(item.suraid) === Number(surahId))
    if (!surah) return `سورة ${surahId}`
    if (language === 'ar') return surah.name_ar || surah.name_en || ''
    if (language === 'he') return surah.name_he || surah.name_en || surah.name_ar || ''
    return surah.name_en || surah.name_ar || ''
  }

  const baseVerses = (concept?.verses || []).map(normalizeVerse)
  const availableFilters = (concept?.terms || []).filter((term) =>
    baseVerses.some((verse) => verse._sourceTerms.includes(term))
  )
  const filteredResults = baseVerses.filter((verse) => {
    if (activeFilters.length === 0) return true
    return filterMode === 'or'
      ? activeFilters.some((term) => verse._sourceTerms.includes(term))
      : activeFilters.every((term) => verse._sourceTerms.includes(term))
  })

  const toggleFilter = (term) => {
    setActiveFilters((current) => current.includes(term)
      ? current.filter((item) => item !== term)
      : [...current, term]
    )
  }

    const handleDelete = async () => {
      const confirmed = window.confirm('Delete this concept and all linked entries?')
      if (!confirmed) return
  
      setDeleting(true)
      try {
        await quranAPI.deleteOntologyConcept(conceptId)
        window.location.href = window.location.origin + getOntologyViewPath(language)
      } catch (err) {
        setError(err?.response?.data?.detail || 'Delete error.')
        setDeleting(false)
      }
    }

  return (
    <ReaderLayout
      sidebar={
        <ConceptSidebar
          title={copy.Ontology}
          activeId={conceptId}
          language={language}
          onClose={() => setSidebarOpen(false)}
        />
      }
      isRtl={isRtl}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
    >
      <div className={`reader-header ${scrolled ? 'scrolled' : ''}`}>
        <div className="flex gap-3">
          <button onClick={() => window.location.href = getOntologyEditPath(language, concept?.id)} disabled={!concept}>
            {copy.edit}
          </button>
          <button onClick={handleDelete} disabled={deleting || saving} style={{ background: '#642121', color: '#fff' }}>{deleting ? copy.deleting : copy.delete}</button>
        </div>
        <div className="reader-controls">
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

      {loading ? (
        <div className="global-spinner-wrapper flex flex-col gap-3">
          <svg className="global-spinner" viewBox="0 0 50 50">
            <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="4"></circle>
          </svg>
          <div className="text-muted" style={{ fontFamily: 'var(--font-serif)' }}>{copy.OntologyLoading}</div>
        </div>
      ) : error ? (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800">{error}</div>
      ) : !concept ? (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">{copy.OntologyNotfound}</div>
      ) : (
        <>


          {baseVerses.length === 0 ? (
            <div className="text-center py-5" style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
              <p className="text-muted">{copy.OntologyNotfound}</p>
            </div>
          ) : (
            <>
              <h1 className="reader-title mb-3">{concept.display_label}</h1>
              <div className="mb-3 flex gap-4">
                <div className="flex gap-4 p-2" style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                  <div>{copy.terms}: {(concept.terms || []).length}</div>
                  <div>{copy.verses}: {baseVerses.length}</div>
                </div>
                <div className="flex gap-2 p-2" style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                  <button
                    style={{ fontSize: '0.75rem', fontWeight: '600', background: filterMode === 'and' ? 'var(--color-accent)' : 'transparent', color: filterMode === 'and' ? '#fff' : 'inherit' }}
                    onClick={() => setFilterMode('and')}>
                    {copy.and}
                  </button>
                  <button
                    style={{ fontSize: '0.75rem', fontWeight: '600', background: filterMode === 'or' ? 'var(--color-accent)' : 'transparent', color: filterMode === 'or' ? '#fff' : 'inherit' }}
                    onClick={() => setFilterMode('or')}>
                    {copy.or}
                  </button>
                  {availableFilters.map((term) => (
                    <button key={term} 
                    style={{ fontSize: '0.85rem', background: activeFilters.includes(term) ? 'var(--color-accent)' : 'var(--color-bg-primary)', color: activeFilters.includes(term) ? '#fff' : 'inherit'}}
                      onClick={() => toggleFilter(term)}>
                      {term}
                    </button>
                  ))}
                </div>
              </div>

              <div className="verses-list flex flex-col gap-5">
                {filteredResults.map((verse) => (
                  <div key={`${verse._surah}:${verse._verse}`} className="p-3"
                    style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                    <div className="mb-2 flex items-center justify-between">
                      <div
                        className="reader-subtitle"
                        style={{ cursor: 'pointer', color: 'var(--color-accent)' }}
                        onClick={() => window.location.href = `${getQuranPath(language, verse._surah)}#verse-${verse._verse}`}
                      >
                        {getSurahLabel(verse._surah)}
                      </div>
                    </div>
                    <Verse
                      verseNum={verse._verse}
                      language={language}
                      textAr={verse._text}
                      fontSize={fontSize}
                    />
                    <div className="mt-2 flex flex-wrap gap-1">
                      {verse._sourceTerms.map((term) => (
                        <span
                          key={`${verse._surah}:${verse._verse}:${term}`}
                          className="px-2 py-0.5"
                          style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', borderRadius: '4px', fontSize: '0.75rem' }}
                        >
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </ReaderLayout>
  )
}
