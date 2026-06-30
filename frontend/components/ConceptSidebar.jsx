import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { quranAPI } from '../api'
import { OntologyConceptPath, OntologyViewPath } from '../siteLanguage'
import { useLanguage } from '../LanguageContext'
import { useReader } from '../ReaderContext'
import SidebarItem from './SidebarItem'

export default function ConceptSidebar({
  title,
  activeId,
  onClose
}) {
  const { language, copy } = useLanguage()
  const { setSidebarOpen } = useReader()
  const navigate = useNavigate()
  const [concepts, setConcepts] = useState([])

  useEffect(() => {
    quranAPI.listOntologyConcepts()
      .then((response) => setConcepts(response.data || []))
      .catch(() => { })
  }, [])

  return (
    <>
      <div className="reader-sidebar-header">
        <Link to={OntologyViewPath(language)} className="reader-title">{title || copy.Ontology}</Link>
        <button className="sidebar-toggle-close" onClick={onClose || (() => setSidebarOpen(false))} aria-label={copy.closeMenu || "Close menu"}>&times;</button>
      </div>
      <ul className="reader-sidebar-list">
        {concepts.map(concept => (
          <SidebarItem
            key={concept.id}
            label={concept.display_label}
            isActive={concept.id === activeId}
            onSelect={() => navigate(OntologyConceptPath(language, concept.id))}
          />
        ))}
      </ul>
    </>
  )
}
