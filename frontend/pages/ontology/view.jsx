import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { quranAPI } from '../../api'
import { AdminOntologyEditPath, AdminOntologyViewPath } from '../../siteLanguage'
import { useLanguage } from '../../LanguageContext'
import ReaderLayout from '../../components/ReaderLayout'
import ConceptSidebar from '../../components/ConceptSidebar'
import OntologyVerseList from './components/OntologyVerseList'
import OntologyDiagram from './components/OntologyDiagram'
import Spinner from '../../components/Spinner'
import { normalizeVerse, getSurahLabel as getSurahLabelUtil } from './utils'

export default function OntologyConceptViewPage({ isAdmin = false }) {
  const { conceptId } = useParams()
  const { language, copy, isRTL } = useLanguage()
  const isRtl = isRTL
  const navigate = useNavigate()

  const [concept, setConcept] = useState(null)
  const [surahs, setSurahs] = useState([])

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
      navigate(AdminOntologyViewPath(language))
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
        />
      }
    >
      {isAdmin && (
        <div className="mb-4 flex gap-3">
          <button onClick={() => navigate(AdminOntologyEditPath(language, concept?.id))} disabled={!concept}>
            {copy.edit}
          </button>
          <button onClick={handleDelete} disabled={deleting} style={{ background: '#642121', color: '#fff' }}>
            {deleting ? copy.deleting : copy.delete}
          </button>
        </div>
      )}

      {loading ? (
        <Spinner label={copy.OntologyLoading} />
      ) : error ? (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800">{error}</div>
      ) : !concept ? (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">{copy.OntologyNotfound}</div>
      ) : (
        <>
          <h1 className="reader-title mb-4" style={{ fontFamily: 'var(--font-serif)' }}>{concept.display_label}</h1>

          {concept.article?.type === 'diagram' && (
            <div className="ontology-tabs">
              <button
                type="button"
                onClick={() => setActiveViewTab('diagram')}
                className={`ontology-tab ${activeViewTab === 'diagram' ? 'active' : ''}`}
              >
                {copy.diagramExplorer || 'Diagram Explorer'}
              </button>
              <button
                type="button"
                onClick={() => setActiveViewTab('verses')}
                className={`ontology-tab ${activeViewTab === 'verses' ? 'active' : ''}`}
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
            <OntologyVerseList verses={baseVerses} language={language} getSurahLabel={getSurahLabel} copy={copy} />
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
