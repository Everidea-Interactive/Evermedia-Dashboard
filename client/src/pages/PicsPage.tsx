import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Card from '../components/ui/Card';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';

type Pic = {
  id: string;
  name: string;
  contact?: string;
  active: boolean;
  roles: string[];
};

export default function PicsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<Pic[]>([]);
  const [role, setRole] = useState('');
  const [active, setActive] = useState('true');
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    contact: '',
    notes: '',
    active: true,
    roles: [] as string[],
  });

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

  const handleAddPic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert('Name is required');
      return;
    }
    setSubmitting(true);
    try {
      await api('/pics', {
        method: 'POST',
        token,
        body: {
          name: form.name,
          contact: form.contact || undefined,
          notes: form.notes || undefined,
          active: form.active,
          roles: form.roles,
        },
      });
      setForm({
        name: '',
        contact: '',
        notes: '',
        active: true,
        roles: [],
      });
      setShowAddForm(false);
      fetchPics();
    } catch (error: any) {
      alert(error?.error || 'Failed to add PIC');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleRole = (roleName: string) => {
    setForm(prev => ({
      ...prev,
      roles: prev.roles.includes(roleName)
        ? prev.roles.filter(r => r !== roleName)
        : [...prev.roles, roleName],
    }));
  };

  return (
    <div>
      <PageHeader
        backPath="/campaigns"
        backLabel="Back to campaigns"
        title={<h2 className="page-title">PICs</h2>}
      />
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Filters</h2>
          <Button variant="primary" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Cancel' : 'Add PIC System'}
          </Button>
        </div>
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
      {showAddForm && (
        <Card className="mt-4">
          <h2 className="text-lg font-semibold mb-3">Add PIC System</h2>
          <form onSubmit={handleAddPic} className="space-y-3">
            <Input
              label="Name"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              required
            />
            <Input
              label="Contact"
              value={form.contact}
              onChange={e => setForm(prev => ({ ...prev, contact: e.target.value }))}
            />
            <Input
              label="Notes"
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Roles</label>
              <div className="flex flex-wrap gap-2">
                {['TALENT', 'EDITOR', 'POSTING'].map(roleName => (
                  <label key={roleName} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.roles.includes(roleName)}
                      onChange={() => toggleRole(roleName)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{roleName}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Adding...' : 'Add PIC System'}
            </Button>
          </form>
        </Card>
      )}
      <div className="mt-4">
        {loading ? (
          <div className="skeleton h-10 w-full" />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(p => (
              <Card key={p.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-gray-500">Roles: {p.roles.join(', ')}</div>
                  </div>
                  <span className={`badge ${p.active ? 'bg-green-50 border-green-200 text-green-700' : ''}`}>
                    {p.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-sm text-gray-600 mt-2">{p.contact}</div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
