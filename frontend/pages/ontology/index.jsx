import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { quranAPI } from '../../api'
import { AdminOntologyAddPath, AdminOntologyConceptPath, AdminOntologyEditPath, OntologyConceptPath } from '../../siteLanguage'
import { useLanguage } from '../../LanguageContext'
import ReaderLayout from '../../components/ReaderLayout'
import ConceptSidebar from '../../components/ConceptSidebar'
import Spinner from '../../components/Spinner'

export default function OntologyViewPage({ isAdmin = false }) {
  const { language, copy } = useLanguage()
  const navigate = useNavigate()
  const [concepts, setConcepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    quranAPI.listOntologyConcepts()
      .then((response) => {
        setConcepts(response.data || [])
      })
      .catch((requestError) => {
        setError(requestError?.response?.data?.detail || copy.OntologyUnavailable)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const handleDelete = async (concept) => {
    const confirmed = window.confirm(`Delete ${concept.display_label} and all linked entries?`)
    if (!confirmed) return
    try {
      await quranAPI.deleteOntologyConcept(concept.id)
      setConcepts((prev) => prev.filter(c => c.id !== concept.id))
    } catch (err) {
      alert(err?.response?.data?.detail || 'Delete error.')
    }
  }

  return (
    <ReaderLayout
      sidebar={
        <ConceptSidebar
          title={copy.Ontology}
        />
      }
    >
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="reader-subtitle">{copy.OntologySubtitle}</p>
        </div>
        {isAdmin && (
          <button onClick={() => navigate(AdminOntologyAddPath(language))}>
            {copy.OntologyAddNewConcept}
          </button>
        )}
      </div>

      {error ? <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800">{error}</div> : null}

      {loading ? (
        <Spinner label={copy.OntologyLoading} />
      ) : concepts.length === 0 ? (
        <div className="text-center py-5" style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
          <p className="text-muted">{copy.OntologyNotfound}</p>
        </div>
      ) : (
        <div className="concept-grid">
          {concepts.map((concept) => (
            <div key={concept.id} className="concept-card">
              <div>
                <h2 className="concept-card-title">{concept.display_label}</h2>
                <div className="concept-card-count">
                  {copy.OntologyVerses} {concept.approved_verse_count}
                </div>
              </div>
              <div className="concept-card-actions">
                <button className="verse-action-btn verse-action-btn--accent" onClick={() => navigate(isAdmin ? AdminOntologyConceptPath(language, concept.id) : OntologyConceptPath(language, concept.id))}>
                  {copy.view} →
                </button>
                {isAdmin && (
                  <>
                    <button style={{ fontSize: '0.85rem' }} onClick={() => navigate(AdminOntologyEditPath(language, concept.id))}>
                      {copy.edit}
                    </button>
                    <button onClick={() => handleDelete(concept)} style={{ background: '#642121', color: '#fff', margin: '0.5rem' }}>
                      {copy.delete}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </ReaderLayout>
  )
}
