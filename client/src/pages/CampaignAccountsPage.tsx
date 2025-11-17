import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';

export default function CampaignAccountsPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api(`/accounts?`, { token }).then(async (accounts) => {
      // filter accounts connected to this campaign
      const linked = await api(`/campaigns/${id}`, { token });
      const accountIds = new Set((linked.accounts || []).map((a: any) => a.id));
      setItems(accounts.filter((a: any) => accountIds.has(a.id)));
    }).finally(() => setLoading(false));
  }, [id, token]);

  const backPath = id ? `/campaigns/${id}` : '/campaigns';

  return (
    <div className="max-w-6xl mx-auto p-4">
      <PageHeader
        backPath={backPath}
        backLabel="Back to campaign"
        title={<h2 className="text-xl font-semibold mb-0">Accounts</h2>}
      />
      {loading ? <div>Loading…</div> : (
        <div className="grid md:grid-cols-2 gap-3">
          {items.map((a: any) => (
            <div key={a.id} className="border rounded p-3 bg-white">
              <div className="flex items-center justify-between">
                <div className="font-medium">{a.name}</div>
                {a.isCrossbrand && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">Crossbrand</span>}
              </div>
              <div className="text-sm text-gray-600">{a.tiktokHandle}</div>
              <div className="text-xs text-gray-500 mt-1">Type: {a.accountType} {a.brand ? `· Brand: ${a.brand}` : ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
