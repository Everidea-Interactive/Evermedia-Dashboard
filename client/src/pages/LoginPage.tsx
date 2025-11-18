import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/campaigns');
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-4 transition-colors" style={{ background: 'linear-gradient(to bottom right, rgba(239, 246, 255, 0.5), var(--bg-primary), rgba(219, 234, 254, 0.5))' }}>
      <form onSubmit={onSubmit} className="w-full max-w-sm card">
        <div className="card-inner">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg grid place-items-center font-semibold" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>TK</div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Sign in</h1>
          </div>
          {error && <div className="mb-3 text-sm" style={{ color: '#dc2626' }}>{error}</div>}
          <div className="space-y-3">
            <Input label="Email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
            <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            <Button disabled={loading} className="w-full" type="submit">{loading ? 'Signing in…' : 'Sign in'}</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
