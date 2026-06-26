import React, { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { quranAPI } from '../../api'
import { AdminOntologyEditPath, AdminOntologyViewPath } from '../../siteLanguage'
import { useLanguage } from '../../LanguageContext'
import { useReader } from '../../ReaderContext'
import ReaderLayout from '../../components/ReaderLayout'
import ConceptSidebar from '../../components/ConceptSidebar'
import OntologyVerseList from './components/OntologyVerseList'
import OntologyDiagram from './components/OntologyDiagram'
import { normalizeVerse, getSurahLabel as getSurahLabelUtil } from './utils'

export default function OntologyConceptViewPage({ isAdmin = false }) {
  const { conceptId } = useParams()
  const { language, copy, isRTL } = useLanguage()
  const isRtl = isRTL
  
  const [concept, setConcept] = useState(null)
  const [surahs, setSurahs] = useState([])
  const { fontSize } = useReader()
  
  const [activeViewTab, setActiveViewTab] = useState('diagram')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    quranAPI.getSurahs()
      .then((response) => setSurahs(response.data || []))
      .catch(() => { })
  }, [])

  useEffect(() => {
    quranAPI.getOntologyConcept(conceptId)
      .then((response) => {
        setConcept(response.data)
        if (response.data?.article?.type === 'diagram') {
          setActiveViewTab('diagram')
        } else {
          setActiveViewTab('verses')
        }
      })
      .catch((requestError) => {
        setError(requestError?.response?.data?.detail || (isRtl ? 'تعذر تحميل المفهوم.' : 'Could not load concept.'))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [conceptId, isRtl])

  const getSurahLabel = (surahId) => getSurahLabelUtil(surahId, surahs, language)

  const baseVerses = useMemo(() => (concept?.verses || []).map(normalizeVerse), [concept])

  const handleDelete = async () => {
    const confirmed = window.confirm('Delete this concept and all linked entries?')
    if (!confirmed) return

    setDeleting(true)
    try {
      await quranAPI.deleteOntologyConcept(conceptId)
      window.location.href = window.location.origin + AdminOntologyViewPath(language)
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
        />
      }
    >
      {isAdmin && (
        <div className="mb-4 flex gap-3">
          <button onClick={() => window.location.href = AdminOntologyEditPath(language, concept?.id)} disabled={!concept}>
            {copy.edit}
          </button>
          <button onClick={handleDelete} disabled={deleting} style={{ background: '#642121', color: '#fff' }}>
            {deleting ? copy.deleting : copy.delete}
          </button>
        </div>
      )}

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
          <h1 className="reader-title mb-4" style={{ fontFamily: 'var(--font-serif)' }}>{concept.display_label}</h1>

          {concept.article?.type === 'diagram' && (
            <div className="flex border-b border-[var(--color-border)] mb-6">
              <button
                onClick={() => setActiveViewTab('diagram')}
                className={`px-4 py-2.5 border-0 cursor-pointer text-sm font-semibold transition-all relative ${
                  activeViewTab === 'diagram'
                    ? 'text-indigo-600 border-b-2 border-indigo-600 bg-transparent'
                    : 'bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {copy.diagramExplorer || 'Diagram Explorer'}
              </button>
              <button
                onClick={() => setActiveViewTab('verses')}
                className={`px-4 py-2.5 border-0 cursor-pointer text-sm font-semibold transition-all relative ${
                  activeViewTab === 'verses'
                    ? 'text-indigo-600 border-b-2 border-indigo-600 bg-transparent'
                    : 'bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {copy.verseList || 'Verse List'} ({baseVerses.length})
              </button>
            </div>
          )}

          {activeViewTab === 'diagram' && concept.article?.type === 'diagram' ? (
            <div className="mb-6">
              <OntologyDiagram data={concept.article} readOnly={true} conceptVerses={concept.verses} />
            </div>
          ) : baseVerses.length > 0 ? (
            <>
              <div className="mb-4 flex flex-wrap gap-4">
                <div className="flex items-center gap-4 p-2 text-xs font-medium" style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                  <div>{copy.verses || 'Verses'}: {baseVerses.length}</div>
                </div>
              </div>
              <OntologyVerseList verses={baseVerses} language={language} getSurahLabel={getSurahLabel} fontSize={fontSize} />
            </>
          ) : (
            <div className="text-center py-5" style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
              <p className="text-muted">{copy.OntologyNotfound}</p>
            </div>
          )}
        </>
      )}
    </ReaderLayout>
  )
}
