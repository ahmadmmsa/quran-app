import { Outlet, Link } from 'react-router-dom';
import { useLanguage } from '../../LanguageContext';

export default function AdminLayout() {
  const { copy } = useLanguage();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flex: 1 }}>
        <aside style={{ width: '250px', borderRight: '1px solid var(--color-border)', padding: '1.5rem' }}>
          <nav>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <li>
                <Link to="/admin/localization" style={{ textDecoration: 'none', fontWeight: 'bold', color: 'var(--color-text)' }}>{copy.Localization}</Link>
              </li>
              <li>
                <Link to="/admin/ontology/concepts" style={{ textDecoration: 'none', fontWeight: 'bold', color: 'var(--color-text)' }}>{copy.Ontology}</Link>
              </li>
            </ul>
          </nav>
        </aside>
        <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
