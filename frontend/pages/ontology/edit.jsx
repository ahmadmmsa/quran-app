import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { quranAPI } from '../../api'
import { useLanguage } from '../../LanguageContext'
import { AdminOntologyViewPath } from '../../siteLanguage'
import OntologyEditor from './components/OntologyEditor'

export default function OntologyEditPage() {
  const { conceptId } = useParams()
  const { language } = useLanguage()
  const [concept, setConcept] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    quranAPI.getOntologyConcept(conceptId)
      .then((response) => setConcept(response.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [conceptId])

  const handleDelete = async () => {
    const confirmed = window.confirm('Delete this concept and all linked entries?')
    if (!confirmed) return

    try {
      await quranAPI.deleteOntologyConcept(conceptId)
      window.location.href = AdminOntologyViewPath(language)
    } catch (err) {
      alert(err?.response?.data?.detail || 'Delete error.')
    }
  }

  if (loading) return null

  return (
    <OntologyEditor 
      mode="edit" 
      initialData={concept} 
      conceptId={conceptId} 
      onDelete={handleDelete} 
    />
  )
}
