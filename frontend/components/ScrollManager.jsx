import { useEffect, useState } from 'react';
import { useLanguage } from '../LanguageContext';

export default function ScrollManager() {
  const { isRTL, copy } = useLanguage();
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!showScrollTop) {
    return null;
  }

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={copy.backToTop || "Go to top"}
      style={{
        position: 'fixed',
        bottom: '30px',
        right: isRTL ? 'auto' : '30px',
        left: isRTL ? '30px' : 'auto',
        zIndex: 1100,
        width: '42px',
        height: '42px',
        borderRadius: '50%',
        background: 'var(--color-accent)',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-md)',
        fontSize: '1.1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'opacity 0.2s ease'
      }}
    >
      ↑
    </button>
  );
}
