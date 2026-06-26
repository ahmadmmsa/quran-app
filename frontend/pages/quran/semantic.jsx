import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { quranAPI } from '../../api'
import { getQuranPath } from '../../siteLanguage'
import { useLanguage } from '../../LanguageContext'
import { useReader } from '../../ReaderContext'
import {
  getVerseNumberValue,
  getVerseSurahLabel,
  getSurahLabel,
  formatVerseNumber,
  getVerseText
} from './shared'
import ReaderLayout from '../../components/ReaderLayout'
import Verse from '../../components/Verse'
import VerseRelated from '../../components/VerseRelated'
import ChapterSidebar from '../../components/ChapterSidebar'

export default function QuranSemantic() {
  const { treeSurahId: routeTreeSurahId, treeVerseNum: routeTreeVerseNum } = useParams()
  const navigate = useNavigate()
  const { language, copy, isRTL } = useLanguage()
  const isRtl = isRTL
  const relatedVerseLimit = 50

  const [surahs, setSurahs] = useState([])
  const [treeSourceVerse, setTreeSourceVerse] = useState(null)
  const [relatedVersesData, setRelatedVersesData] = useState(null)
  const [treeLoading, setTreeLoading] = useState(false)
  const [treeError, setTreeError] = useState('')
  const { fontSize, setSidebarOpen } = useReader()
  const [scrolled, setScrolled] = useState(false)

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

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
        <div className="global-spinner-wrapper flex flex-col gap-3">
          <svg className="global-spinner" viewBox="0 0 50 50">
            <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="4"></circle>
          </svg>
          <div style={{ fontFamily: 'var(--font-serif)' }}>{copy.relatedVersesLoading}</div>
        </div>
      ) : treeError ? (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800">{treeError}</div>
      ) : (
        <>
          <div className="related-verses-selected">
            <span className="reader-subtitle">
              {getVerseSurahLabel(treeSourceVerse, surahs, language)}
            </span>
            <Verse
              verseNum={treeVerseNum}
              language={language}
              textEn={language === 'en' ? getVerseText(treeSourceVerse, 'en') : null}
              textAr={language === 'ar' ? getVerseText(treeSourceVerse, 'ar') : null}
              fontSize={fontSize}
            />
            {sourceTerms.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {sourceTerms.map((term, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1"
                    style={{ background: 'var(--color-highlight)', borderRadius: '4px', fontSize: '0.9rem' }}
                    title={term.pos_ar || term.pos}
                  >
                    {term.term}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="related-verses">
            {relatedResults.length > 0 ? (
              relatedResults.map((verse, idx) => (
                <div className="related-verses-container" key={idx}>
                  <div className="reader-subtitle mb-2 flex items-center justify-between">
                    {getVerseSurahLabel(verse, surahs, language)}
                    <a className="related-verses-link" href={`${getQuranPath(language, verse.suranum)}#verse-${verse.versenum}`}>{copy.goToVerse}</a>
                  </div>
                  <VerseRelated
                    verseNum={verse.versenum}
                    language={language}
                    textEn={language === 'en' ? getVerseText(verse, 'en') : null}
                    textAr={language === 'ar' ? getVerseText(verse, 'ar') : null}
                    fontSize={fontSize}
                  />
                  {(verse.matched_terms || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {verse.matched_terms.map((m, i) => (
                        <span key={i} className="px-1 text-sm" style={{ background: 'var(--color-bg-secondary)', borderRadius: '2px' }}>{m}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">{copy.relatedVersesUnavailable}</div>
            )}
          </div>
        </>
      )}
    </ReaderLayout>
  )
}
