import React, { useEffect, useState } from 'react'
import { quranAPI } from '../../api'
import { AdminOntologyAddPath, AdminOntologyConceptPath, AdminOntologyEditPath, OntologyConceptPath } from '../../siteLanguage'
import { useLanguage } from '../../LanguageContext'
import ReaderLayout from '../../components/ReaderLayout'
import ConceptSidebar from '../../components/ConceptSidebar'

export default function OntologyViewPage({ isAdmin = false }) {
  const { language, copy, isRTL } = useLanguage()
  const isRtl = isRTL
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
  }, [isRtl])

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
          language={language}
        />
      }
    >
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="reader-subtitle">{copy.OntologySubtitle}</p>
        </div>
        {isAdmin && (
          <button onClick={() => window.location.href = AdminOntologyAddPath(language)}>
            {copy.OntologyAddNewConcept}
          </button>
        )}
      </div>

      {error ? <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800">{error}</div> : null}

      {loading ? (
        <div className="global-spinner-wrapper flex flex-col gap-3">
          <svg className="global-spinner" viewBox="0 0 50 50">
            <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="4"></circle>
          </svg>
          <div className="text-muted" style={{ fontFamily: 'var(--font-serif)' }}>{copy.OntologyLoading}</div>
        </div>
      ) : concepts.length === 0 ? (
        <div className="text-center py-5" style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
          <p className="text-muted">{copy.OntologyNotfound}</p>
        </div>
      ) : (
        <div className="ontology-list flex flex-col gap-4">
          {concepts.map((concept) => (
            <div
              key={concept.id}
              className="p-4"
              style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', transition: 'all 0.2s ease' }}
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>{concept.display_label}</h2>
                  <div className="text-muted text-sm">
                    {copy.OntologyVerses} {concept.approved_verse_count}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button style={{ fontSize: '0.85rem' }} onClick={() => window.location.href = isAdmin ? AdminOntologyConceptPath(language, concept.id) : OntologyConceptPath(language, concept.id)}>
                    {copy.view}
                  </button>
                  {isAdmin && (
                    <>
                      <button style={{ fontSize: '0.85rem' }} onClick={() => window.location.href = AdminOntologyEditPath(language, concept.id)}>
                        {copy.edit}
                      </button>
                      <button onClick={() => handleDelete(concept)} style={{ background: '#642121', color: '#fff', margin: '0.5rem' }}>
                        {copy.delete}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ReaderLayout>
  )
}
