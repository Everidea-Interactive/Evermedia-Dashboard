import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Link } from 'react-router-dom';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Card from '../components/ui/Card';
import { TableWrap, Table, THead, TH, TR, TD } from '../components/ui/Table';

type Campaign = {
  id: string;
  name: string;
  category: string;
  startDate: string;
  endDate: string;
  status: string;
};

export default function CampaignsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<Campaign[]>([]);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`/campaigns?status=${encodeURIComponent(status)}&category=${encodeURIComponent(q)}`, { token })
      .then(setItems)
      .finally(() => setLoading(false));
  }, [token, status, q]);

  return (
    <div>
      <div className="mb-4">
        <h1 className="page-title">Campaigns</h1>
      </div>
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select label="Status" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All</option>
            <option>PLANNED</option>
            <option>ACTIVE</option>
            <option>COMPLETED</option>
            <option>PAUSED</option>
          </Select>
          <div className="sm:col-span-2">
            <Input label="Category" value={q} onChange={e => setQ(e.target.value)} placeholder="Search category" />
          </div>
        </div>
      </Card>

      <div className="mt-4">
        {loading ? (
          <div className="skeleton h-10 w-full" />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Category</TH>
                  <TH>Start</TH>
                  <TH>End</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <tbody>
                {items.map((c) => (
                  <TR key={c.id}>
                    <TD><Link to={`/campaigns/${c.id}`} className="text-indigo-700 hover:underline font-medium">{c.name}</Link></TD>
                    <TD>{c.category}</TD>
                    <TD>{new Date(c.startDate).toLocaleDateString()}</TD>
                    <TD>{new Date(c.endDate).toLocaleDateString()}</TD>
                    <TD><span className="badge">{c.status}</span></TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </div>
    </div>
  );
}
