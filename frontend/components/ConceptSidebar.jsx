import { useEffect, useState } from 'react'
import { quranAPI } from '../api'
import { OntologyConceptPath, OntologyViewPath } from '../siteLanguage'
import { useLanguage } from '../LanguageContext'
import { useReader } from '../ReaderContext'

export default function ConceptSidebar({
  title,
  activeId,
  onClose
}) {
  const { language, copy } = useLanguage()
  const { setSidebarOpen } = useReader()
  const [concepts, setConcepts] = useState([])

  useEffect(() => {
    quranAPI.listOntologyConcepts()
      .then((response) => setConcepts(response.data || []))
      .catch(() => { })
  }, [])

  return (
    <>
      <div className="reader-sidebar-header">
        <a href={OntologyViewPath(language)} className="reader-title">{title || copy.Ontology}</a>
        <button className="sidebar-toggle-close" onClick={onClose || (() => setSidebarOpen(false))} aria-label={copy.closeMenu || "Close menu"}>&times;</button>
      </div>
      <ul className="reader-sidebar-list">
        {concepts.map(concept => (
          <li
            key={concept.id}
            className={`reader-sidebar-item ${concept.id === activeId ? 'active' : ''}`}
            onClick={() => window.location.href = OntologyConceptPath(language, concept.id)}
          >
            {concept.display_label}
          </li>
        ))}
      </ul>
    </>
  )
}
