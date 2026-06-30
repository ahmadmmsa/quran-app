import { useState, useEffect } from 'react';
import { useLanguage } from '../../LanguageContext';
import { adminAPI } from '../../api';

export default function LocalizationEditor() {
  const { language, copy: currentCopy } = useLanguage();
  const [locales, setLocales] = useState({});
  const [selectedLang, setSelectedLang] = useState('en');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [msgError, setMsgError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newKey, setNewKey] = useState('');

  useEffect(() => {
    adminAPI.getLocales()
      .then(response => {
        setLocales(response.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setMessage(currentCopy.loadLocalesError || 'Error loading locales.'); setMsgError(true);
        setLoading(false);
      });
  }, []);

  const handleSave = () => {
    setSaving(true);
    adminAPI.updateLocales(locales)
    .then(response => {
      setMessage(currentCopy.localesSaved || 'Saved! Reload the page to see changes.'); setMsgError(false);
      setSaving(false);
      setTimeout(() => setMessage(''), 5000);
    })
    .catch(err => {
      setMessage(currentCopy.saveError || 'Error saving.'); setMsgError(true);
      setSaving(false);
    });
  };

  const handleChange = (key, value) => {
    setLocales(prev => ({
      ...prev,
      [selectedLang]: {
        ...prev[selectedLang],
        [key]: value
      }
    }));
  };

  const handleAddKey = () => {
    if (!newKey.trim()) return;
    const key = newKey.trim();
    setLocales(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(lang => {
        updated[lang] = { ...updated[lang] };
        if (updated[lang][key] === undefined) {
          updated[lang][key] = '';
        }
      });
      return updated;
    });
    setNewKey('');
  };

  if (loading) return <div>{currentCopy.loading || 'Loading...'}</div>;

  const currentStrings = locales[selectedLang] || {};

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ margin: 0 }}>{currentCopy.Localization}</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select 
            value={selectedLang} 
            onChange={e => setSelectedLang(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }}
          >
            {Object.keys(locales).map(l => (
              <option key={l} value={l}>{l.toUpperCase()}</option>
            ))}
          </select>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '0.5rem 1.5rem', cursor: 'pointer', borderRadius: 'var(--radius-sm)' }}
          >
            {saving ? currentCopy.saving || 'Saving...' : currentCopy.save || 'Save'}
          </button>
        </div>
      </div>

      {message && <div style={{ padding: '1rem', background: msgError ? 'var(--color-bg-secondary)' : '#d4edda', color: msgError ? 'var(--color-text)' : '#155724', marginBottom: '1.5rem', borderRadius: 'var(--radius-sm)' }}>{message}</div>}

      <div style={{ display: 'flex', width: '100%', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        
        <div style={{ display: 'flex', width: '100%', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder={currentCopy.newTranslationKey || "New translation key…"}
            value={newKey}
            onChange={e => setNewKey(e.target.value)}
            style={{ padding: '0.75rem', width: '100%', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
          />
          <button
            onClick={handleAddKey}
            style={{ padding: '0.75rem 1.5rem', cursor: 'pointer', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text)' }}
          >
            +
          </button>
        </div>
      </div>

<div>
  <input
          type="text"
          placeholder={currentCopy.searchKeysPlaceholder || "Search keys or values…"}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ padding: '0.75rem', marginBottom: '1rem', width: '100%', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
        />
</div>
      <div style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {Object.entries(currentStrings)
          .filter(([key, value]) => key.toLowerCase().includes(searchQuery.toLowerCase()) || String(value || '').toLowerCase().includes(searchQuery.toLowerCase()))
          .map(([key, value]) => (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{key}</label>
            <input 
              type="text" 
              value={value} 
              onChange={e => handleChange(key, e.target.value)} 
              style={{ padding: '0.75rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', color: 'var(--color-text)' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
