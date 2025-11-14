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
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-indigo-50 via-white to-indigo-100 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm card">
        <div className="card-inner">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-indigo-600/10 grid place-items-center text-indigo-700 font-semibold">TK</div>
            <h1 className="text-xl font-semibold">Sign in</h1>
          </div>
          {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
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
