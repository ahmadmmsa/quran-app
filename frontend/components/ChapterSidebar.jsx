export default function ChapterSidebar({
  title,
  items, // array of { id, label }
  activeId,
  onSelect,
  onClose
}) {
  return (
    <>
      <div className="reader-sidebar-header">
        <span>{title}</span>
        <button className="md:hidden" onClick={onClose} aria-label="Close menu">x</button>
      </div>
      <ul className="reader-sidebar-list">
        {items.map(item => (
          <li
            key={item.id}
            className={`reader-sidebar-item ${item.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(item.id)}
          >
            {item.label}
          </li>
        ))}
      </ul>
    </>
  )
}
