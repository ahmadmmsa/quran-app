import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { quranAPI } from '../../api'
import { getQuranPath } from '../../siteLanguage'
import { useLanguage } from '../../LanguageContext'
import {
  getVerseSurahLabel,
  getSurahLabel,
  formatVerseNumber,
  getVerseText,
  formatVerseForCopy
} from './shared'
import ReaderLayout from '../../components/ReaderLayout'
import Verse from '../../components/Verse'
import ChapterSidebar from '../../components/ChapterSidebar'
import Spinner from '../../components/Spinner'
import SearchResultCard from '../../components/SearchResultCard'
import { useReader } from '../../ReaderContext'
import useCopyVerse from '../../hooks/useCopyVerse'

export default function QuranSemantic() {
  const { treeSurahId: routeTreeSurahId, treeVerseNum: routeTreeVerseNum } = useParams()
  const navigate = useNavigate()
  const { language, copy } = useLanguage()
  const relatedVerseLimit = 50

  const [surahs, setSurahs] = useState([])
  const [treeSourceVerse, setTreeSourceVerse] = useState(null)
  const [relatedVersesData, setRelatedVersesData] = useState(null)
  const [treeLoading, setTreeLoading] = useState(false)
  const [treeError, setTreeError] = useState('')
  const { setSidebarOpen } = useReader()
  const { copiedKey, copyVerse } = useCopyVerse((verse) => formatVerseForCopy(verse, surahs, language))

  const treeSurahId = Number(routeTreeSurahId)
  const treeVerseNum = Number(routeTreeVerseNum)

  useEffect(() => {
    quranAPI.getSurahs().then((res) => setSurahs(Array.isArray(res.data) ? res.data : [])).catch(console.error)
  }, [])

  useEffect(() => {
    if (!treeSurahId || !treeVerseNum) {
      navigate(getQuranPath(language), { replace: true })
      return
    }

    let cancelled = false

    setTreeSourceVerse(null)
    setRelatedVersesData(null)
    setTreeError('')
    setTreeLoading(true)

    Promise.all([
      quranAPI.getVerses(treeSurahId),
      quranAPI.getRelatedVerses(treeSurahId, treeVerseNum, {
        limit: relatedVerseLimit
      })
    ])
      .then(([versesRes, relatedRes]) => {
        if (cancelled) return

        const sourceVerse = versesRes.data.find((verse) => Number(verse.verse_num ?? verse.versenum) === treeVerseNum)

        if (!sourceVerse) {
          setTreeError(copy.relatedVersesUnavailable)
          return
        }

        setTreeSourceVerse({
          ...sourceVerse,
          suraid: treeSurahId,
          verse_num: sourceVerse.verse_num ?? sourceVerse.versenum
        })
        setRelatedVersesData(relatedRes.data)
      })
      .catch((error) => {
        if (cancelled) return
        console.error(error)
        setTreeError(copy.relatedVersesError)
      })
      .finally(() => {
        if (!cancelled) {
          setTreeLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [copy.relatedVersesError, copy.relatedVersesUnavailable, language, navigate, relatedVerseLimit, treeSurahId, treeVerseNum])

  const sidebarItems = (Array.isArray(surahs) ? surahs : []).map(surah => ({
    id: surah.suraid,
    label: getSurahLabel(surah, language)
  }))

  const sidebarContent = (
    <ChapterSidebar
      title={copy.surahs}
      items={sidebarItems}
      activeId={treeSurahId}
      onSelect={(id) => { navigate(getQuranPath(language, id)); setSidebarOpen(false) }}
      onClose={() => setSidebarOpen(false)}
    />
  )

  const sourceTerms = relatedVersesData?.source_terms || []
  const relatedResults = relatedVersesData?.results || []

  return (
    <ReaderLayout sidebar={sidebarContent}>

      {treeLoading ? (
        <Spinner label={copy.relatedVersesLoading} />
      ) : treeError ? (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800">{treeError}</div>
      ) : (
        <>
          <div className="tree-source-card">
            <div className="tree-source-head">
              <span className="tree-source-label">{copy.exploringRelations || 'Exploring relations to'}</span>
              <span className="tree-ref-pill">{getVerseSurahLabel(treeSourceVerse, surahs, language)} · {formatVerseNumber(treeSurahId, language)}:{formatVerseNumber(treeVerseNum, language)}</span>
            </div>
            <Verse
              verseNum={treeVerseNum}
              language={language}
              textEn={language === 'en' ? getVerseText(treeSourceVerse, 'en') : null}
              textAr={language === 'ar' ? getVerseText(treeSourceVerse, 'ar') : null}
            />
            {sourceTerms.length > 0 && (
              <div className="tree-terms">
                {sourceTerms.map((term, idx) => (
                  <span key={idx} className="tree-term" title={term.pos_ar || term.pos}>
                    {term.term}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="tree-related-head">
            <span className="tree-related-title">{copy.relatedVerses || 'Related verses'}</span>
            <span className="tree-related-count">{relatedResults.length}</span>
          </div>
          <div className="tree-related-hint">{copy.relatedVersesHint || 'Sharing roots, names or themes with this verse'}</div>

          {relatedResults.length > 0 ? (
            relatedResults.map((verse) => {
              const key = `${verse.suranum}:${verse.versenum}`
              const copied = copiedKey === key
              const verseHref = `${getQuranPath(language, verse.suranum)}#verse-${verse.versenum}`
              return (
                <SearchResultCard
                  key={key}
                  label={getVerseSurahLabel(verse, surahs, language)}
                  reference={`${verse.suranum}:${verse.versenum}`}
                  onLabelClick={() => navigate(verseHref)}
                  actions={
                    <>
                      <button
                        type="button"
                        className={`verse-action-btn${copied ? ' is-copied' : ''}`}
                        onClick={() => copyVerse(key, verse)}
                      >
                        {copied ? `✓ ${copy.copied || 'Copied'}` : (copy.copy || 'Copy')}
                      </button>
                      <a className="verse-action-btn verse-action-btn--accent" href={verseHref}>
                        {copy.goToVerse || 'Go to verse'} →
                      </a>
                    </>
                  }
                >
                  <Verse
                    verseNum={null}
                    language={language}
                    textEn={language === 'en' ? getVerseText(verse, 'en') : null}
                    textAr={language === 'ar' ? getVerseText(verse, 'ar') : null}
                  />
                  {(verse.matched_terms || []).length > 0 && (
                    <div className="tree-matched">
                      <span className="tree-matched-label">{copy.matched || 'matched'}</span>
                      {verse.matched_terms.map((m, i) => (
                        <span key={i} className="tree-term tree-term--sm">{m}</span>
                      ))}
                    </div>
                  )}
                </SearchResultCard>
              )
            })
          ) : (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">{copy.relatedVersesUnavailable}</div>
          )}
        </>
      )}
    </ReaderLayout>
  )
}
