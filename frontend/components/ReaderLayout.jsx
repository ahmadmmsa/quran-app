import { useLanguage } from '../LanguageContext'

export default function ReaderLayout({
  sidebar,
  children,
  isRtl,
  sidebarOpen,
  setSidebarOpen
}) {
  const { isRTL } = useLanguage()
  const resolvedIsRtl = typeof isRtl === 'boolean' ? isRtl : isRTL

  return (
    <div className="reader-layout" dir={resolvedIsRtl ? 'rtl' : 'ltr'}>

      {/* Mobile Sidebar Toggle */}
      {sidebar && (
        <button className="md:hidden" style={{ width: '20px', height: '20px' }} onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>
      )}

      {/* Sidebar Overlay for Mobile */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="reader-main-container">
        {/* Sidebar */}
        <aside className={`reader-sidebar ${sidebarOpen ? 'open' : ''}`}>
          {sidebar}
        </aside>

        {/* Main Reading Area */}
        <main className="reader-content">
          {children}
        </main>
      </div>
    </div>
  )
}
