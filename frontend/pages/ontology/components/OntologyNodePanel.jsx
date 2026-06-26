import { useEffect, useMemo, useState } from 'react'
import { quranAPI } from '../../../api'
import { useLanguage } from '../../../LanguageContext'
import { getSurahLabel } from '../utils'

const verseKey = (v) => `${v.surah}:${v.verse}`
const verseText = (r) => r.verse_txt_raw || r.verse_txt || r.verse_txt_en || r.verse_txt_he || ''

export default function OntologyNodePanel({ node, onChange, onDelete, onClose }) {
  const { language, copy } = useLanguage()
  const { label, comment, verses = [] } = node.data

  const [surahs, setSurahs] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [suggesting, setSuggesting] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    quranAPI.getSurahs().then((r) => setSurahs(r.data || [])).catch(() => {})
  }, [])

  // Reset transient lists when switching nodes.
  useEffect(() => { setSuggestions([]); setResults([]); setQuery('') }, [node.id])

  const connectedKeys = useMemo(() => new Set(verses.map(verseKey)), [verses])
  const surahName = (surah) => getSurahLabel(surah, surahs, language)

  const addVerse = (v) => {
    const item = { surah: Number(v.surah), verse: Number(v.verse), text: v.text || '', surah_name: surahName(v.surah) }
    if (connectedKeys.has(verseKey(item))) return
    onChange({ verses: [...verses, item] })
  }
  const removeVerse = (key) => onChange({ verses: verses.filter((v) => verseKey(v) !== key) })

  const runSuggest = async () => {
    setSuggesting(true)
    try {
      const text = [label, comment].filter(Boolean).join('. ')
      const res = await quranAPI.suggestOntologyVerses({
        text,
        verses: verses.map((v) => ({ surah: v.surah, verse: v.verse })),
        limit: 12,
      })
      setSuggestions((res.data.results || []).map((r) => ({
        surah: r.surah, verse: r.verse, text: verseText(r), sources: r.sources || [],
      })))
    } catch { setSuggestions([]) } finally { setSuggesting(false) }
  }

  const runSearch = async (e) => {
    e?.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await quranAPI.search(query.trim(), { literalPerPage: 8, expansionPerPage: 8 })
      const rows = [...(res.data.literal?.results || []), ...(res.data.expansion?.results || [])]
      const seen = new Set()
      const flat = []
      for (const r of rows) {
        const surah = r.suraid ?? r.suranum, verse = r.verse_num ?? r.versenum
        const k = `${surah}:${verse}`
        if (seen.has(k)) continue
        seen.add(k)
        flat.push({ surah: Number(surah), verse: Number(verse), text: verseText(r) })
      }
      setResults(flat.slice(0, 12))
    } catch { setResults([]) } finally { setSearching(false) }
  }

  const VerseRow = ({ v, action, badges }) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--color-accent)', fontWeight: 600 }}>
          {surahName(v.surah)} {v.surah}:{v.verse}
          {badges?.map((b) => (
            <span key={b} data-loc style={{ marginInlineStart: 6, fontSize: 9, padding: '0 5px', borderRadius: 999, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>{b === 'text' ? (copy.sourceText || 'text') : b === 'verses' ? (copy.sourceVerses || 'verses') : b}</span>
          ))}
        </div>
        {v.text && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.text}</div>}
      </div>
      {action}
    </div>
  )

  const btn = { fontSize: 12, padding: '2px 8px' }

  return (
    <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', padding: 12, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>{copy.editNode || 'Edit node'}</strong>
        <button onClick={onClose} style={btn}>✕</button>
      </div>

      <label style={{ fontSize: 12 }}>
        {copy.nodeTitle || 'Title'}
        <input className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1 mt-1"
          value={label} onChange={(e) => onChange({ label: e.target.value })} />
      </label>

      <label style={{ fontSize: 12 }}>
        {copy.articleNotes || 'Article / notes'}
        <textarea className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1 mt-1"
          rows={4} value={comment} onChange={(e) => onChange({ comment: e.target.value })} />
      </label>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{copy.connectedVerses || 'Connected verses'} ({verses.length})</div>
        {verses.length === 0 && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{copy.noVersesYet || 'None yet — suggest or search below.'}</div>}
        {verses.map((v) => (
          <VerseRow key={verseKey(v)} v={v} action={<button onClick={() => removeVerse(verseKey(v))} style={btn}>−</button>} />
        ))}
      </div>

      <div>
        <button onClick={runSuggest} disabled={suggesting} style={{ ...btn, width: '100%', padding: '6px 8px' }}>
          {suggesting ? (copy.searching || 'Suggesting…') : ('✦ ' + (copy.suggestRelatedVerses || 'Suggest related verses'))}
        </button>
        {suggestions.map((v) => (
          <VerseRow key={`s-${verseKey(v)}`} v={v} badges={v.sources}
            action={<button onClick={() => addVerse(v)} disabled={connectedKeys.has(verseKey(v))} style={btn}>+</button>} />
        ))}
      </div>

      <form onSubmit={runSearch}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="flex-1 rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1" style={{ fontSize: 12 }}
            placeholder={copy.searchVersesPlaceholder || "Search verses…"} value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="submit" disabled={searching} style={btn}>{searching ? '…' : (copy.search || 'Search')}</button>
        </div>
        {results.map((v) => (
          <VerseRow key={`r-${verseKey(v)}`} v={v}
            action={<button onClick={() => addVerse(v)} disabled={connectedKeys.has(verseKey(v))} style={btn}>+</button>} />
        ))}
      </form>

      <button onClick={onDelete} style={{ ...btn, background: '#642121', color: '#fff', padding: '6px 8px' }}>{copy.deleteNode || 'Delete node'}</button>
    </div>
  )
}
