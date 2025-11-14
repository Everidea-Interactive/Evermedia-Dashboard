import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, api } from '../lib/api';
import Card from '../components/ui/Card';
import Select from '../components/ui/Select';

type Pic = {
  id: string;
  name: string;
  contact?: string;
  active: boolean;
  roles: string[];
  avatarUrl?: string | null;
};

export default function PicsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<Pic[]>([]);
  const [role, setRole] = useState('');
  const [active, setActive] = useState('true');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const fetchPics = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (active) params.set('active', active);
    api(`/pics?${params.toString()}`, { token })
      .then(setItems)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPics();
  }, [token, role, active]);

  const handleAvatarUpload = async (picId: string, file: File) => {
    if (!file) return;
    setUploading((prev) => ({ ...prev, [picId]: true }));
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      await fetch(`${API_BASE_URL}/api/pics/${picId}/avatar`, {
        method: 'POST',
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      fetchPics();
    } finally {
      setUploading((prev) => ({ ...prev, [picId]: false }));
    }
  };

  return (
    <div>
      <div className="mb-3"><h2 className="page-title">PICs</h2></div>
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select label="Role" value={role} onChange={e => setRole(e.target.value)}>
            <option value="">All</option>
            <option>TALENT</option>
            <option>EDITOR</option>
            <option>POSTING</option>
          </Select>
          <Select label="Active" value={active} onChange={e => setActive(e.target.value)}>
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </div>
      </Card>
      <div className="mt-4">
        {loading ? <div className="skeleton h-10 w-full" /> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(p => (
            <Card key={p.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {p.avatarUrl ? (
                    <img src={p.avatarUrl.startsWith('http') ? p.avatarUrl : `${API_BASE_URL}${p.avatarUrl}`} alt="avatar" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-gray-200" />
                  )}
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-gray-500">Roles: {p.roles.join(', ')}</div>
                  </div>
                </div>
                <span className={`badge ${p.active ? 'bg-green-50 border-green-200 text-green-700' : ''}`}>{p.active ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="text-sm text-gray-600 mt-2">{p.contact}</div>
              <label className="mt-3 flex flex-col text-xs text-gray-500">
                Upload avatar
                <input
                  className="hidden"
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarUpload(p.id, file);
                    e.target.value = '';
                  }}
                />
                <span className="btn btn-outline text-xs mt-2">{uploading[p.id] ? 'Uploading…' : 'Pick file'}</span>
              </label>
            </Card>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
