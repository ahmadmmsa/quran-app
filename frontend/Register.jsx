import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from './api';
import { useLanguage } from './LanguageContext';
import 'altcha';

export default function Register() {
  const { copy } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const altchaRef = useRef(null);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    
    const altchaPayload = altchaRef.current?.value;
    if (!altchaPayload) {
      setError(copy.captchaRequired || 'Please complete the captcha verification.');
      return;
    }

    setLoading(true);

    try {
      await authAPI.register({ email, password, altcha: altchaPayload });
      navigate('/admin/login');
    } catch (err) {
      setError(err.response?.data?.detail || copy.registrationFailed || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '4rem auto', padding: '2rem', background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-lg)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem', fontFamily: 'var(--font-serif)', fontSize: '2rem' }}>{copy.registerAdmin || 'Register Admin'}</h2>
      
      {error && <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 'var(--radius-sm)' }}>{error}</div>}

      <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>{copy.email || 'Email'}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>{copy.password || 'Password'}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)' }}
          />
        </div>
        
        <div style={{ marginTop: '1rem' }}>
          <altcha-widget
            ref={altchaRef}
            challengeurl="/api/auth/altcha-challenge"
          ></altcha-widget>
        </div>

        <button type="submit" disabled={loading} style={{ padding: '0.75rem', background: 'var(--color-accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: '600', marginTop: '1rem' }}>
          {loading ? (copy.registering || 'Registering…') : (copy.register || 'Register')}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>
        <Link to="/admin/login" style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>{copy.alreadyHaveAccount || 'Already have an account? Login'}</Link>
      </div>
    </div>
  );
}
