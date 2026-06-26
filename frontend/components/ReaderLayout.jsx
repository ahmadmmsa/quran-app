import { useLanguage } from '../LanguageContext'
import { useReader } from '../ReaderContext'

export default function ReaderLayout({
  sidebar,
  children,
}) {
  const { isRTL } = useLanguage()
  const { sidebarOpen, setSidebarOpen } = useReader()

  return (
    <div className="reader-layout" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)}/>
      <div className="reader-main-container">
        <aside className={`reader-sidebar ${sidebarOpen ? 'open' : ''}`}>
          {sidebar}
        </aside>
        <main className="reader-content">
          {children}
        </main>
      </div>
    </div>
  )
}
