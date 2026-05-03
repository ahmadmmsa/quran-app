import { formatVerseNumber } from '../pages/quran/shared'

export default function Verse({
  verseNum,
  language,
  textEn,
  textAr,
  textHe,
  basmalaParts,
  onClick,
  fontSize
}) {
  const isBilingual = language === 'ar' ? false : (language === 'he' ? !!textHe : false); 
  const renderText = () => {
    if (language === 'ar' && textAr) {
      return <p className="verse-text-ar">{textAr}</p>
    }
    if (language === 'he' && textHe) {
      return <p className="verse-text-he">{textHe}</p>
    }
    return <p className="verse-text-en">{textEn}</p>
  }

  const verseStyle = fontSize ? { fontSize: `${fontSize}px` } : {}

  if (basmalaParts) {
    return (
      <div style={verseStyle}>
        <div className="basmala-block">{basmalaParts.basmala}</div>
        {basmalaParts.remainder && (
          <div className="verse-container" style={verseStyle} onClick={onClick}>
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
    <div className="verse-container" style={verseStyle} onClick={onClick}>
      <span className={`verse-number ${language === 'ar' ? 'verse-number-rtl' : 'verse-number-ltr'}`}>
        {formatVerseNumber(verseNum, language)}
      </span>
      {renderText()}
    </div>
  )
}
