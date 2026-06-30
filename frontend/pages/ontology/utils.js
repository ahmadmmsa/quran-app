import { getSurahLabel as getSurahName } from '../quran/shared'

export function normalizeVerse(verse) {
  const surah = Number(verse?.suraid ?? verse?.surah ?? verse?._surah ?? 0)
  const verseNum = Number(verse?.verse_num ?? verse?.verse ?? verse?._verse ?? 0)
  return {
    ...verse,
    _surah: surah,
    _verse: verseNum,
    _text: verse?.verse_txt_raw || verse?.verse_txt || verse?.verse_txt_en || verse?.verse_txt_he || '',
    _sourceTerms: verse?.source_terms || verse?._sourceTerms || [],
    _score: Number(verse?.aggregated_search_score || verse?._score || 0)
  }
}

export function getSurahLabel(surahId, surahs, language) {
  const surah = (Array.isArray(surahs) ? surahs : []).find((item) => Number(item.suraid) === Number(surahId))
  return surah ? getSurahName(surah, language) : `سورة ${surahId}` // Fallback Arabic
}
