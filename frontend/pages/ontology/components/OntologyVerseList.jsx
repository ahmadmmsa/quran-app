import { useNavigate } from 'react-router-dom'
import Verse from '../../../components/Verse'
import SearchResultCard from '../../../components/SearchResultCard'
import { getQuranPath } from '../../../siteLanguage'

export default function OntologyVerseList({
  verses,
  language,
  getSurahLabel,
  copy = {},
  resultKey = (verse) => `${verse._surah}:${verse._verse}`
}) {
  const navigate = useNavigate()

  return (
    <div>
      {verses.map((verse) => {
        const key = resultKey(verse)
        const verseHref = `${getQuranPath(language, verse._surah)}#verse-${verse._verse}`

        return (
          <SearchResultCard
            key={key}
            label={getSurahLabel(verse._surah)}
            reference={`${verse._surah}:${verse._verse}`}
            onLabelClick={() => navigate(verseHref)}
            actions={
              <a className="verse-action-btn verse-action-btn--accent" href={verseHref}>
                {copy.goToVerse || 'Go to verse'} →
              </a>
            }
          >
            {/* Ontology verses store Arabic source text, so always render it as Arabic. */}
            <Verse verseNum={null} language="ar" textAr={verse._text} />
          </SearchResultCard>
        )
      })}
    </div>
  )
}
