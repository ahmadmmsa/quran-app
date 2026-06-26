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
  if (!surah) return `سورة ${surahId}` // Fallback Arabic
  if (language === 'ar') return surah.name_ar || surah.name_en || ''
  if (language === 'he') return surah.name_he || surah.name_en || surah.name_ar || ''
  return surah.name_en || surah.name_ar || ''
}
