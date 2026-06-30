import { useLanguage } from '../LanguageContext'
import { clickableProps } from './a11y'

export default function ChapterSidebar({
  title,
  items,
  activeId,
  onSelect,
  onClose
}) {
  const { copy } = useLanguage()
  return (
    <>
      <div className="reader-sidebar-header">
        <span>{title}</span>
        <button className="sidebar-toggle-close" onClick={onClose} aria-label={copy.closeMenu || "Close menu"}>x</button>
      </div>
      <ul className="reader-sidebar-list">
        {items.map(item => (
          <li
            key={item.id}
            className={`reader-sidebar-item ${item.id === activeId ? 'active' : ''}`}
            {...clickableProps(() => onSelect(item.id))}
          >
            {item.label}
          </li>
        ))}
      </ul>
    </>
  )
}
