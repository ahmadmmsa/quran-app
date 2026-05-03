import { useEffect, useState } from 'react'
import { quranAPI } from '../api'
import { getOntologyConceptViewPath, getOntologyViewPath } from '../siteLanguage'
import { useLanguage } from '../LanguageContext'

export default function ConceptSidebar({
  title,
  activeId,
  onClose
}) {
  const { language, copy } = useLanguage()
  const [concepts, setConcepts] = useState([])

  useEffect(() => {
    quranAPI.listOntologyConcepts()
      .then((response) => setConcepts(response.data || []))
      .catch(() => { })
  }, [])

  return (
    <>
      <div className="reader-sidebar-header">
        <a href={getOntologyViewPath(language)} className="reader-title">{title || copy.Ontology}</a>
        <button className="md:hidden" onClick={onClose} aria-label="Close menu">x</button>
      </div>
      <ul className="reader-sidebar-list">
        {concepts.map(concept => (
          <li
            key={concept.id}
            className={`reader-sidebar-item ${concept.id === activeId ? 'active' : ''}`}
            onClick={() => window.location.href = getOntologyConceptViewPath(language, concept.id)}
          >
            {concept.display_label}
          </li>
        ))}
      </ul>
    </>
  )
}
