export const getTagTerm = (tag) => (typeof tag === 'string' ? tag : tag?.term || '')

// Clickable "related terms" chips shared by the Quran and Bible search views.
export default function RelatedTags({ tags, onSelect }) {
  if (!tags?.length) return null
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {tags.map((tag) => (
        <button key={getTagTerm(tag)} type="button" onClick={() => onSelect(tag)}>
          {getTagTerm(tag)}
          {typeof tag === 'object' && typeof tag?.count === 'number' && (
            <span className="ms-2 text-muted text-sm">{tag.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}
