import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { quranAPI } from '../../api'
import { getQuranPath, getQuranTreePath } from '../../siteLanguage'
import { useLanguage } from '../../LanguageContext'
import { useReader } from '../../ReaderContext'
import {
  getSurahLabel,
  getArabicBasmalaParts,
  getVerseText
} from './shared'
import ReaderLayout from '../../components/ReaderLayout'
import ChapterSidebar from '../../components/ChapterSidebar'
import Verse from '../../components/Verse'

export default function QuranIndex() {
  const { surahId: routeSurahId } = useParams()
  const surahId = routeSurahId || '1'
  const sid = parseInt(surahId)
  const navigate = useNavigate()
  const { language, copy, isRTL } = useLanguage()
  const isRtl = isRTL

  const [surahs, setSurahs] = useState([])
  const [verses, setVerses] = useState([])
  const [loading, setLoading] = useState(false)
  const { fontSize, setSidebarOpen } = useReader()
  
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    quranAPI.getSurahs().then((res) => setSurahs(Array.isArray(res.data) ? res.data : [])).catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    quranAPI.getVerses(sid).then(res => setVerses(Array.isArray(res.data) ? res.data : [])).catch(console.error).finally(() => setLoading(false))
  }, [sid])

  useEffect(() => {
    if (verses.length === 0) return
    const hash = window.location.hash
    if (hash) {
      const el = document.getElementById(hash.slice(1))
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [verses])

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleVerseClick = (verse) => {
    const sourceSurahId = verse?.suraid ?? verse?.suranum ?? sid
    const sourceVerseNum = verse?.verse_num ?? verse?.versenum

    if (!sourceSurahId || !sourceVerseNum) return
    navigate(getQuranTreePath(language, sourceSurahId, sourceVerseNum))
  }

  const currentSurah = (Array.isArray(surahs) ? surahs : []).find(s => s.suraid === sid)

  const sidebarItems = (Array.isArray(surahs) ? surahs : []).map(surah => ({
    id: surah.suraid,
    label: getSurahLabel(surah, language)
  }))

  const sidebarContent = (
    <ChapterSidebar
      title={copy.surahs}
      items={sidebarItems}
      activeId={sid}
      onSelect={(id) => { navigate(getQuranPath(language, id)); setSidebarOpen(false) }}
      onClose={() => setSidebarOpen(false)}
    />
  )

  return (
    <ReaderLayout sidebar={sidebarContent}>
      {loading ? (
        <div className="global-spinner-wrapper flex flex-col gap-3">
          <svg className="global-spinner" viewBox="0 0 50 50">
            <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="4"></circle>
          </svg>
          <div className="text-muted" style={{ fontFamily: 'var(--font-serif)' }}>{copy.loading}</div>
        </div>
      ) : (
        <>
          <h1 className="reader-title">{getSurahLabel(currentSurah, language)}</h1>
          <div className="verses-list">
            {verses.map((verse, idx) => {
              const arabicBasmalaParts = getArabicBasmalaParts(verse, language)

              // Depending on language, we show Arabic, English, or both
              const textAr = language === 'ar' ? getVerseText(verse, 'ar') : null
              const textEn = language === 'en' ? getVerseText(verse, 'en') : null

              return (
                <div key={idx} id={`verse-${verse.verse_num}`}>
                  <Verse
                    verseNum={verse.verse_num}
                    language={language}
                    textEn={textEn}
                    textAr={textAr}
                    textHe={null}
                    basmalaParts={arabicBasmalaParts}
                    onClick={() => handleVerseClick(verse)}
                    fontSize={fontSize}
                  />
                </div>
              )
            })}
          </div>
        </>
      )}
    </ReaderLayout>
  )
}
