import React from 'react'
import Verse from '../../../components/Verse'
import { getQuranPath } from '../../../siteLanguage'

export default function OntologyVerseList({
  verses,
  language,
  getSurahLabel,
  fontSize,
  resultKey = (verse) => `${verse._surah}:${verse._verse}`
}) {
  return (
    <div className="verses-list flex flex-col gap-4">
      {verses.map((verse) => {
        const key = resultKey(verse)

        return (
          <div key={key} className="block">
            <div 
              className="p-3" 
              style={{ 
                border: '1px solid var(--color-border)', 
                borderRadius: 'var(--radius-md)', 
                background: 'transparent',
                transition: 'background 0.2s ease'
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="reader-subtitle"
                    style={{ cursor: 'pointer', color: 'var(--color-accent)' }}
                    onClick={() => window.location.href = `${getQuranPath(language, verse._surah)}#verse-${verse._verse}`}
                  >
                    {getSurahLabel(verse._surah)} {verse._surah}:{verse._verse}
                  </div>
                </div>
              </div>
              <Verse 
                verseNum={verse._verse} 
                language={language} 
                textAr={verse._text} 
                fontSize={fontSize} 
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
