import { clickableProps } from './a11y'

export default function SidebarItem({ label, isActive, onSelect }) {
  return (
    <li className={`reader-sidebar-item ${isActive ? 'active' : ''}`} {...clickableProps(onSelect)}>
      {label}
    </li>
  )
}
