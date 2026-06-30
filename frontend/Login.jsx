import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { authAPI } from './api';
import { GoogleLogin } from '@react-oauth/google';
import { useLanguage } from './LanguageContext';

export default function Login() {
  const { copy } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login({ email, password });
      login(response.data.access_token);
      navigate('/admin/localization');
    } catch (err) {
      setError(err.response?.data?.detail || copy.loginFailed || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const response = await authAPI.googleLogin(credentialResponse.credential);
      login(response.data.access_token);
      navigate('/admin/localization');
    } catch (err) {
      setError(copy.googleLoginFailed || 'Google login failed.');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '4rem auto', padding: '2rem', background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-lg)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem', fontFamily: 'var(--font-serif)', fontSize: '2rem' }}>{copy.adminLogin || 'Admin Login'}</h2>
      
      {error && <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: 'var(--radius-sm)' }}>{error}</div>}

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
        
        <button type="submit" disabled={loading} style={{ padding: '0.75rem', background: 'var(--color-accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: '600', marginTop: '1rem' }}>
          {loading ? (copy.loggingIn || 'Logging in…') : (copy.Login || 'Login')}
        </button>
      </form>

      <div style={{ margin: '2rem 0', display: 'flex', alignItems: 'center', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        <div style={{ flex: 1, borderTop: '1px solid var(--color-border)' }}></div>
        <span style={{ margin: '0 10px' }}>{copy.or || 'or'}</span>
        <div style={{ flex: 1, borderTop: '1px solid var(--color-border)' }}></div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => setError(copy.googleLoginFailed || 'Google login failed.')}
        />
      </div>

      <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>
        <Link to="/admin/register" style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>{copy.createAccount || 'Create an account'}</Link>
      </div>
    </div>
  );
}
