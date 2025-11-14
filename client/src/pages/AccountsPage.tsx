import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';

type Account = {
  id: string;
  name: string;
  tiktokHandle?: string;
  accountType: 'BRAND_SPECIFIC'|'CROSSBRAND';
  brand?: string;
  isCrossbrand?: boolean;
};

export default function AccountsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<Account[]>([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [crossbrand, setCrossbrand] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (type) params.set('accountType', type);
    if (crossbrand) params.set('crossbrand', crossbrand);
    api(`/accounts?${params.toString()}`, { token })
      .then(setItems)
      .finally(() => setLoading(false));
  }, [token, search, type, crossbrand]);

  return (
    <div>
      <div className="mb-3"><h2 className="page-title">Accounts</h2></div>
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2"><Input label="Search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or handle" /></div>
          <Select label="Type" value={type} onChange={e => setType(e.target.value)}>
            <option value="">All</option>
            <option>BRAND_SPECIFIC</option>
            <option>CROSSBRAND</option>
          </Select>
          <Select label="Crossbrand" value={crossbrand} onChange={e => setCrossbrand(e.target.value)}>
            <option value="">All</option>
            <option value="true">Only Crossbrand</option>
            <option value="false">Only Single-brand</option>
          </Select>
        </div>
      </Card>
      <div className="mt-4">
        {loading ? <div className="skeleton h-10 w-full" /> : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(a => (
              <Card key={a.id}>
                <div className="flex items-center justify-between">
                  <div className="font-medium">{a.name}</div>
                  {a.isCrossbrand && <span className="badge text-indigo-700 bg-indigo-50 border-indigo-100">Crossbrand</span>}
                </div>
                <div className="text-sm text-gray-600">{a.tiktokHandle}</div>
                <div className="text-xs text-gray-500 mt-1">Type: {a.accountType} {a.brand ? `· Brand: ${a.brand}` : ''}</div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
