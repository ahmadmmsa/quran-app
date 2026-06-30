import { useState, useEffect } from 'react'
import { quranAPI } from '../../../api'
import { useLanguage } from '../../../LanguageContext'
import ReaderLayout from '../../../components/ReaderLayout'
import ConceptSidebar from '../../../components/ConceptSidebar'
import OntologyDiagram from './OntologyDiagram'

export default function OntologyEditor({ mode = 'create', initialData = null, conceptId = null, onDelete = null }) {
  const { language, copy } = useLanguage()

  const [label, setLabel] = useState('')
  const [article, setArticle] = useState(null)
  const [selectedVerses, setSelectedVerses] = useState({})

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    if (initialData) {
      setLabel(initialData.label || '')
      setArticle(initialData.article || null)
      const selected = {}
      for (const verse of initialData.verses || []) {
        const surah = Number(verse?.suraid ?? verse?.surah ?? verse?._surah ?? 0)
        const verseNum = Number(verse?.verse_num ?? verse?.verse ?? verse?._verse ?? 0)
        selected[`${surah}:${verseNum}`] = { surah, verse: verseNum, source_terms: [] }
      }
      setSelectedVerses(selected)
    }
  }, [initialData])

  const handleSave = async () => {
    const selected = Object.values(selectedVerses)
    if (!label.trim()) {
      setError(copy.OntologyConceptLabelRequired || 'Please provide a label for the concept.')
      return
    }
    setSaving(true)
    setError('')
    setSaveMessage('')
    try {
      const payload = { label: label.trim() || null, article, terms: [], selected_verses: selected }
      let response
      if (mode === 'create') {
        response = await quranAPI.createOntologyConcept(payload)
        setSaveMessage(`${copy.savedConcept || 'Saved concept: '}${response.data.display_label}`)
      } else {
        response = await quranAPI.updateOntologyConcept(conceptId, payload)
        setSaveMessage(copy.updated || 'Updated')
      }
    } catch (err) { 
      setError(err?.response?.data?.detail || copy.saveError || 'Error saving.') 
    } finally { 
      setSaving(false) 
    }
  }

  return (
    <ReaderLayout
      sidebar={<ConceptSidebar title={copy.Ontology} activeId={conceptId} />}
    >
      {error && <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800">{error}</div>}
      {saveMessage && <div className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-800">{saveMessage}</div>}
      
      <div>
        <div className="mb-4">
          {mode === 'edit' && onDelete && (
            <button 
              onClick={onDelete} 
              disabled={saving} 
              style={{ background: '#642121', color: '#fff', margin: '0.5rem' }}
            >
              {copy.delete}
            </button>
          )}
          <div className="p-3" style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
            <div className="mb-4">
              <label className="mb-2 block">{copy.OntologyConceptLabel}</label>
              <input 
                className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2" 
                type="text" 
                value={label} 
                onChange={(e) => setLabel(e.target.value)}
                placeholder={copy.OntologyConceptLabel}
              />
            </div>
            <div className="mb-6">
              <label className="mb-2 block text-sm font-semibold text-[var(--color-text-secondary)]">{copy.ontologyDiagramDesigner || 'Concept Diagram Designer'}</label>
              <OntologyDiagram 
                data={article} 
                onChange={(newArticle) => {
                  setArticle(newArticle);
                  
                  if (newArticle && Array.isArray(newArticle.nodes)) {
                    const nextSelected = {};
                    newArticle.nodes.forEach(node => {
                      if (Array.isArray(node.verses)) {
                        node.verses.forEach(v => {
                          const key = `${v.surah}:${v.verse}`;
                          nextSelected[key] = {
                            surah: Number(v.surah),
                            verse: Number(v.verse),
                            source_terms: v.source_terms || []
                          };
                        });
                      }
                    });
                    setSelectedVerses(nextSelected);
                  }
                }}
                readOnly={false}
                conceptVerses={Object.values(selectedVerses)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleSave} disabled={saving}>
                {saving ? (mode === 'create' ? (copy.searching || 'Saving...') : (copy.saving || 'Saving...')) : copy.save}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ReaderLayout>
  )
}
