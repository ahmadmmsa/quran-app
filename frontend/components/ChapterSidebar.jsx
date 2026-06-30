import { useLanguage } from '../LanguageContext'
import SidebarItem from './SidebarItem'

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
          <SidebarItem
            key={item.id}
            label={item.label}
            isActive={item.id === activeId}
            onSelect={() => onSelect(item.id)}
          />
        ))}
      </ul>
    </>
  )
}
