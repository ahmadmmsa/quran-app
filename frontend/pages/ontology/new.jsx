import { useState, useEffect } from 'react'
import { quranAPI } from '../../api'
import { useLanguage } from '../../LanguageContext'
import ReaderLayout from '../../components/ReaderLayout'
import ConceptSidebar from '../../components/ConceptSidebar'
import Verse from '../../components/Verse'

function normalizeTerms(terms) {
  const seen = new Set()
  return (terms || []).map((term) => String(term || '').trim()).filter((term) => {
    if (!term || seen.has(term)) return false
    seen.add(term)
    return true
  })
}

function normalizeVerse(verse) {
  const surah = Number(verse?.suraid ?? verse?.surah ?? verse?._surah ?? 0)
  const verseNum = Number(verse?.verse_num ?? verse?.verse ?? verse?._verse ?? 0)
  return {
    ...verse,
    _surah: surah,
    _verse: verseNum,
    _text: verse?.verse_txt_raw || verse?.verse_txt || verse?.verse_txt_en || verse?.verse_txt_he || '',
    _sourceTerms: verse?.source_terms || verse?._sourceTerms || [],
    _score: Number(verse?.aggregated_search_score || verse?._score || 0)
  }
}

export default function OntologyAddPage() {
  const { language, copy, isRTL } = useLanguage()
  const isRtl = isRTL
  const [label, setLabel] = useState('')
  const [terms, setTerms] = useState([])
  const [termInput, setTermInput] = useState('')
  const [fontSize, setFontSize] = useState(() => {
    return parseInt(localStorage.getItem('quran-font-size') || '28')
  })
  const [surahs, setSurahs] = useState([])
  const [results, setResults] = useState([])
  const [selectedVerses, setSelectedVerses] = useState({})
  const [activeFilters, setActiveFilters] = useState([])
  const [filterMode, setFilterMode] = useState('and')
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    quranAPI.getSurahs().then((response) => setSurahs(response.data)).catch(() => { })
  }, [])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const getSurahLabel = (surahId) => {
    const surah = surahs.find((item) => Number(item.suraid) === Number(surahId))
    if (!surah) return `Ø³ÙˆØ±Ø© ${surahId}`
    if (language === 'ar') return surah.name_ar || surah.name_en || ''
    return surah.name_en || surah.name_ar || ''
  }

  const normalizedResults = results.map(normalizeVerse)
  const resultKey = (verse) => `${verse._surah}:${verse._verse}`
  const availableFilters = terms.filter((term) => normalizedResults.some((verse) => verse._sourceTerms.includes(term)))
  const filteredResults = normalizedResults.filter((verse) => {
    if (activeFilters.length === 0) return true
    const sourceTerms = verse._sourceTerms
    return filterMode === 'or'
      ? activeFilters.some((term) => sourceTerms.includes(term))
      : activeFilters.every((term) => sourceTerms.includes(term))
  })

  const addTerm = () => {
    const nextTerm = String(termInput || '').trim()
    if (!nextTerm) return
    setTerms((current) => normalizeTerms([...current, nextTerm]))
    setTermInput('')
  }

  const removeTerm = (termToRemove) => {
    setTerms((current) => current.filter((term) => term !== termToRemove))
    setActiveFilters((current) => current.filter((term) => term !== termToRemove))
  }

  const handleTermInputKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === 'ØŒ') {
      event.preventDefault()
      addTerm()
    }
  }

  const handleSearch = async (event) => {
    if (event) event.preventDefault()
    if (terms.length === 0) {
      setError(isRtl ? 'Ø£Ø¯Ø®Ù„ ÙƒÙ„Ù…Ø© ÙˆØ§Ø­Ø¯Ø© Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„.' : 'Enter at least one term.')
      return
    }
    setError('')
    setSaveMessage('')
    setSearching(true)
    try {
      const response = await quranAPI.searchOntologySeeds(terms)
      setResults(response.data.results || [])
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || 'Search error.')
    } finally {
      setSearching(false)
    }
  }

  const handleToggleVerse = (verse, checked) => {
    const key = resultKey(verse)
    setSelectedVerses((current) => {
      if (!checked) {
        const next = { ...current }
        delete next[key]
        return next
      }
      return { ...current, [key]: { surah: verse._surah, verse: verse._verse, source_terms: verse._sourceTerms } }
    })
  }

  const handleSave = async () => {
    const selected = Object.values(selectedVerses)
    if (terms.length === 0 || selected.length === 0) {
      setError(isRtl ? 'Ø£Ø¯Ø®Ù„ Ø§Ù„ÙƒÙ„Ù…Ø§Øª ÙˆØ§Ø®ØªØ± Ø¢ÙŠØ© ÙˆØ§Ø­Ø¯Ø© Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„.' : 'Enter terms and select at least one verse.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const response = await quranAPI.createOntologyConcept({ label: label.trim() || null, terms, selected_verses: selected })
      setSaveMessage(isRtl ? `ØªÙ… Ø­ÙØ¸ ${response.data.display_label}` : `Saved ${response.data.display_label}`)
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || 'Save error.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ReaderLayout
      sidebar={
        <ConceptSidebar
          title={copy.Ontology}
          language={language}
          onClose={() => setSidebarOpen(false)}
        />
      }
      isRtl={isRtl}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
    >
      {error ? <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800">{error}</div> : null}
      {saveMessage ? <div className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-800">{saveMessage}</div> : null}

      <div>
        <div className="mb-4">
          <div className="p-3"
            style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
            <div className="mb-4">
              <label className="mb-2 block">{copy.OntologyConceptLabel}</label>
              <input className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2" type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={copy.OntologyConceptLabel} />
            </div>
            <div className="mb-4">
              <label className="mb-2 block">{copy.OntologySeedTerms}</label>
              <div className="mb-2 flex flex-wrap gap-2 p-2"
                style={{ background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <input className="rounded-md border border-[var(--color-border)] px-2 py-1" type="text" value={termInput} onChange={(e) => setTermInput(e.target.value)} onKeyDown={handleTermInputKeyDown} placeholder={copy.addTerm} />
                <button className="rounded-md border border-[var(--color-border)] px-2 py-1" onClick={addTerm}>+</button>
                {terms.map((term) => (
                  <span key={term} className="flex items-center gap-1 px-2"
                    style={{ borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                    {term} <span style={{ cursor: 'pointer' }} onClick={() => removeTerm(term)}>x</span>
                  </span>
                ))}
                <button onClick={handleSearch} disabled={searching}>
                  {searching ? copy.searching : copy.search}
                </button>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving || Object.keys(selectedVerses).length === 0}>
              {saving ? copy.searching : copy.save}
            </button>
          </div>
        </div>

        <div>
          {results.length > 0 && (
            <>
              <div className="reader-controls mb-4">
                <input type="range" min="16" max="56" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} style={{ width: '80px' }} />
              </div>
              <div className="mb-4 flex items-center justify-between">
                <div className="text-muted text-sm">
                  {copy.results} : {filteredResults.length} ,
                  {copy.selected} : {Object.keys(selectedVerses).length}
                </div>
                <div className="flex gap-2">
                  <button style={{ fontSize: '0.75rem' }} onClick={() => {
                    const next = {};
                    filteredResults.forEach((v) => {
                      next[resultKey(v)] = { surah: v._surah, verse: v._verse, source_terms: v._sourceTerms }
                    })
                    setSelectedVerses(next);
                  }}>{copy.selectAll}</button>
                  <button style={{ fontSize: '0.75rem' }} onClick={() => {
                    setSelectedVerses({});
                  }}>{copy.selectNone}</button>
                </div>
              </div>
              <div className="verses-list flex flex-col gap-4">
                {filteredResults.map((verse) => {
                  const key = resultKey(verse);
                  const checked = Boolean(selectedVerses[key]);
                  return (
                    <label key={key}>
                      <div className="p-3" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: checked ? 'var(--color-highlight)' : 'transparent' }}>
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input type="checkbox" checked={checked} onChange={(e) => handleToggleVerse(verse, e.target.checked)} />
                            <span className="text-muted text-sm">{getSurahLabel(verse._surah)} {verse._surah}:{verse._verse}</span>
                          </div>
                        </div>
                        <Verse verseNum={verse._verse} language={language} textAr={verse._text} fontSize={fontSize} />
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
                      </div></label>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </ReaderLayout>
  )
}
