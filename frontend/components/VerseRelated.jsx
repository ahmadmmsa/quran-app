import { formatVerseNumber } from '../pages/quran/shared'

export default function VerseRelated({
  verseNum,
  language,
  textEn,
  textAr,
  textHe,
  basmalaParts,
  onClick,
  highlightedText
}) {
  const isBilingual = language === 'ar' ? false : (language === 'he' ? !!textHe : false); 
  const renderText = () => {
    if (highlightedText) {
      let className = "verse-text-en";
      if (language === 'ar') className = "verse-text-ar";
      else if (language === 'he') className = "verse-text-he";
      return <p className={className} dangerouslySetInnerHTML={{ __html: highlightedText }} />
    }

    if (language === 'ar' && textAr) {
      return <p className="verse-text-ar">{textAr}</p>
    }
    if (language === 'he' && textHe) {
      return <p className="verse-text-he">{textHe}</p>
    }
    return <p className="verse-text-en">{textEn}</p>
  }

  if (basmalaParts) {
    return (
      <div>
        <div className="basmala-block">{basmalaParts.basmala}</div>
        {basmalaParts.remainder && (
          <div className="verse-container" onClick={onClick}>
            <span className={`verse-number ${language === 'ar' ? 'verse-number-rtl' : 'verse-number-ltr'}`}>
              {formatVerseNumber(verseNum, language)}
            </span>
            <p className="verse-basmala-part">{basmalaParts.remainder}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="verse-container" onClick={onClick}>
      <span className={`verse-number ${language === 'ar' ? 'verse-number-rtl' : 'verse-number-ltr'}`}>
        {formatVerseNumber(verseNum, language)}
      </span>
      {renderText()}
    </div>
  )
}
