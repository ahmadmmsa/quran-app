import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { quranAPI } from '../../api'
import { useLanguage } from '../../LanguageContext'
import { getOntologyViewPath } from '../../siteLanguage'
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

export default function OntologyEditPage() {
  const { conceptId } = useParams()
  const { language, copy, isRTL } = useLanguage()
  const isRtl = isRTL
  const [concept, setConcept] = useState(null)
  const [surahs, setSurahs] = useState([])
  const [label, setLabel] = useState('')
  const [terms, setTerms] = useState([])
  const [termInput, setTermInput] = useState('')
  const [fontSize, setFontSize] = useState(() => {
    return parseInt(localStorage.getItem('quran-font-size') || '28')
  })
  const [results, setResults] = useState([])
  const [selectedVerses, setSelectedVerses] = useState({})
  const [activeFilters, setActiveFilters] = useState([])
  const [filterMode, setFilterMode] = useState('and')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [error, setError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    quranAPI.getSurahs().then((response) => setSurahs(response.data || [])).catch(() => { })
  }, [])

  useEffect(() => {
    quranAPI.getOntologyConcept(conceptId)
      .then((response) => {
        const item = response.data
        setConcept(item)
        setLabel(item.label || '')
        setTerms(normalizeTerms(item.terms || []))
        const selected = {}
        for (const verse of item.verses || []) {
          const nv = normalizeVerse(verse)
          selected[`${nv._surah}:${nv._verse}`] = { surah: nv._surah, verse: nv._verse, source_terms: nv._sourceTerms }
        }
        setSelectedVerses(selected)
      })
      .catch((err) => setError(isRtl ? '..' : 'Could not load concept.'))
      .finally(() => setLoading(false))
  }, [conceptId, isRtl])

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

  const resultKey = (verse) => `${verse._surah}:${verse._verse}`
  const baseVerses = results.length > 0 ? results.map(normalizeVerse) : (concept?.verses || []).map(normalizeVerse)
  const filteredResults = baseVerses.filter((verse) => {
    if (activeFilters.length === 0) return true
    return filterMode === 'or'
      ? activeFilters.some((term) => verse._sourceTerms.includes(term))
      : activeFilters.every((term) => verse._sourceTerms.includes(term))
  })

  const addTerm = () => {
    const nextTerm = String(termInput || '').trim()
    if (!nextTerm) return
    setTerms((current) => normalizeTerms([...current, nextTerm]))
    setTermInput('')
  }

  const removeTerm = (t) => {
    setTerms((current) => current.filter((term) => term !== t))
    setActiveFilters((current) => current.filter((term) => term !== t))
  }

  const handleSearch = async (e) => {
    if (e) e.preventDefault()
    setSearching(true)
    setError(''); setSaveMessage('')
    try {
      const response = await quranAPI.searchOntologySeeds(terms)
      setResults(response.data.results || [])
    } catch (err) { setError('Search error.') } finally { setSearching(false) }
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
    if (terms.length === 0 || selected.length === 0) return
    setSaving(true)
    setError(''); setSaveMessage('')
    try {
      await quranAPI.updateOntologyConcept(conceptId, { label: label.trim() || null, terms, selected_verses: selected })
      setSaveMessage(isRtl ? copy.updateError : copy.updated)
    } catch (err) { setError('Save error.') } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    const confirmed = window.confirm('Delete this concept and all linked entries?')
    if (!confirmed) return

    setDeleting(true)
    setError('')
    setSaveMessage('')

    try {
      await quranAPI.deleteOntologyConcept(conceptId)
      window.location.href = getOntologyViewPath(language)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Delete error.')
      setDeleting(false)
    }
  }

  return (
    <ReaderLayout sidebar={<ConceptSidebar title={copy.Ontology} activeId={conceptId} language={language} onClose={() => setSidebarOpen(false)} />} isRtl={isRtl} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}>
      {error ? <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800">{error}</div> : null}
      {saveMessage ? <div className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-800">{saveMessage}</div> : null}
      <div>
        <div className="mb-4">
          <button onClick={handleDelete} disabled={deleting || saving} style={{ background: '#642121', color: '#fff', margin: '0.5rem' }}>{deleting ? copy.deleting : copy.delete}</button>
          <div className="p-3"
            style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
            <div className="mb-4">
              <label className="mb-2 block">{copy.OntologyConceptLabel}</label>
              <input className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2" type="text" value={label} onChange={(e) => setLabel(e.target.value)}
                style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }} />
            </div>
            <div className="mb-4">
              <label className="mb-2 block">{copy.OntologySeedTerms}</label>
              <div className="mb-2 flex flex-wrap gap-2 p-2"
                style={{ background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <input className="rounded px-2" style={{ width: '120px', border: '1px solid var(--color-border)' }}
                  type="text" value={termInput}
                  onChange={(e) => setTermInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTerm()}
                  placeholder={copy.addTerm} />
                <button onClick={addTerm} className="rounded px-1 py-0"
                  style={{ cursor: 'pointer', border: '1px solid var(--color-border)' }}>+</button>
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
            <div className="flex flex-wrap gap-2">
              <button onClick={handleSave} disabled={saving || deleting || Object.keys(selectedVerses).length === 0}>
                {saving ? copy.saving : copy.save}
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="reader-controls mb-4">
            <input type="range" min="16" max="56" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))}
              style={{ width: '80px' }} />
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
                  <div className="p-3"
                    style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: checked ? 'var(--color-highlight)' : 'transparent' }}>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={checked} onChange={(e) => {
                          const c = e.target.checked;
                          setSelectedVerses(curr => {
                            const next = { ...curr };
                            if (!c) delete next[key];
                            else next[key] = { surah: verse._surah, verse: verse._verse, source_terms: verse._sourceTerms };
                            return next;
                          });
                        }} />
                        <span className="text-muted text-sm">{getSurahLabel(verse._surah)}</span>
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
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </ReaderLayout>
  )
}
