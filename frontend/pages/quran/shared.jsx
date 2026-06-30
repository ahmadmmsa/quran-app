const ARABIC_NUMS = '٠١٢٣٤٥٦٧٨٩';

const toArabicIndic = (num) => String(num ?? "").replace(/\d/g, d => ARABIC_NUMS[d]);
export const formatVerseNumber = (num, language) => language === 'ar' ? toArabicIndic(num) : String(num ?? '')

export const getSurahLabel = (surah, language) => {
  if (!surah) return ''
  if (language === 'ar') return surah.name_ar || surah.name_en || surah.name_he || ''
  if (language === 'he') return surah.name_he || surah.name_en || surah.name_ar || ''
  return surah.name_en || surah.name_ar || surah.name_he || ''
}

export const getVerseSurahId = (verse, overrideSurahId, fallbackSurahId) => overrideSurahId ?? verse?.suraid ?? verse?.suranum ?? parseInt(fallbackSurahId)
export const getVerseNumberValue = (verse) => verse?.verse_num ?? verse?.versenum ?? ''
export const getVerseSurahLabel = (verse, surahs, language, fallbackSurahId) => {
  if (!verse) return ''
  const verseSurahId = getVerseSurahId(verse, null, fallbackSurahId)
  const surah = (Array.isArray(surahs) ? surahs : []).find((item) => item.suraid === Number(verseSurahId))
  return getSurahLabel(surah, language)
}

const getArabicVerseText = (verse) => {
  if (!verse) return ''
  return verse.verse_txt || verse.verse_txt_raw || verse.verse_txt_en || verse.verse_txt_he || ''
}

export const getVerseText = (verse, language) => {
  if (!verse) return ''
  if (language === 'ar') return getArabicVerseText(verse)
  if (language === 'he') return verse.verse_txt_he || verse.verse_txt_en || verse.verse_txt || ''
  return verse.verse_txt_en || verse.verse_txt || verse.verse_txt_he || ''
}

// Builds a clean, paste-friendly block: surah label + reference, the verse, an
// optional translation, and a trailing citation.
export const formatVerseForCopy = (verse, surahs, language) => {
  const surahLabel = getVerseSurahLabel(verse, surahs, language)
  const surahId = verse?.suranum ?? verse?.suraid ?? ''
  const verseNum = getVerseNumberValue(verse)
  const ref = `${surahId}:${verseNum}`
  const arabic = getVerseText(verse, 'ar')
  const translation = getVerseText(verse, language === 'ar' ? 'en' : language)
  const lines = [`${surahLabel} (${ref})`, '']
  if (arabic) lines.push(arabic)
  if (translation && translation !== arabic) lines.push('', `\u201c${translation}\u201d`)
  lines.push('', `\u2014 Qur'an ${ref}`)
  return lines.join('\n')
}

const BASMALA_PREFIXES = [
  'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
  'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
  'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
  'بسم الله الرحمن الرحيم'
]

export const getArabicBasmalaParts = (verse, language) => {
  if (language !== 'ar') return null
  if (Number(getVerseNumberValue(verse)) !== 1) return null

  const fullText = getArabicVerseText(verse).trim()
  const basmala = BASMALA_PREFIXES.find((prefix) => fullText.startsWith(prefix))

  if (!basmala) {
    return null
  }

  return {
    basmala,
    remainder: fullText.slice(basmala.length).trim()
  }
}
