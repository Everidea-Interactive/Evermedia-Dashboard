import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { api } from '../lib/api';
import Card from '../components/ui/Card';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import Toast from '../components/ui/Toast';
import RequirePermission from '../components/RequirePermission';
import PageHeader from '../components/PageHeader';
import { TableWrap, Table, THead, TR, TH, TD } from '../components/ui/Table';

type Pic = {
  id: string;
  name: string;
  active: boolean;
  roles: string[];
};

export default function PicsPage() {
  const { token } = useAuth();
  const { canManagePics, canDelete } = usePermissions();
  const [allPics, setAllPics] = useState<Pic[]>([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState('true');
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [form, setForm] = useState({
    name: '',
    active: true,
    roles: [] as string[],
  });

  const fetchPics = () => {
    setLoading(true);
    api(`/pics`, { token })
      .then(data => {
        setAllPics(data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPics();
  }, [token]);

  const filteredItems = useMemo(() => {
    let filtered = allPics;
    if (role) {
      filtered = filtered.filter(p => p.roles.some(r => r.toUpperCase() === role.toUpperCase()));
    }
    if (active) {
      filtered = filtered.filter(p => {
        if (active === 'true') return p.active === true;
        if (active === 'false') return p.active === false;
        return true;
      });
    }
    const q = search.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.roles || []).some(r => r.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [allPics, search, role, active]);

  const resetForm = () => {
    setForm({
      name: '',
      active: true,
      roles: [],
    });
  };

  const handleAddPic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setToast({ message: 'Name is required', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      await api('/pics', {
        method: 'POST',
        token,
        body: {
          name: form.name,
          active: form.active,
          roles: form.roles,
        },
      });
      resetForm();
      setShowAddForm(false);
      fetchPics();
      setToast({ message: 'PIC added successfully', type: 'success' });
    } catch (error: any) {
      setToast({ message: error?.error || 'Failed to add PIC', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPic = (pic: Pic) => {
    setEditingId(pic.id);
    setForm({
      name: pic.name,
      active: pic.active,
      roles: [...pic.roles],
    });
    setShowAddForm(false);
  };

  const handleUpdatePic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !form.name.trim()) {
      setToast({ message: 'Name is required', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      await api(`/pics/${editingId}`, {
        method: 'PUT',
        token,
        body: {
          name: form.name,
          active: form.active,
          roles: form.roles,
        },
      });
      resetForm();
      setEditingId(null);
      fetchPics();
      setToast({ message: 'PIC updated successfully', type: 'success' });
    } catch (error: any) {
      setToast({ message: error?.error || 'Failed to update PIC', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeletingIds(prev => new Set(prev).add(id));
    setDeleteConfirm(null);
    try {
      await api(`/pics/${id}`, { method: 'DELETE', token });
      fetchPics();
      setToast({ message: 'PIC deleted successfully', type: 'success' });
    } catch (error: any) {
      setToast({ message: error?.error || 'Failed to delete PIC', type: 'error' });
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleCancelEdit = () => {
    resetForm();
    setEditingId(null);
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
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2 sm:gap-3">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2 w-full">
            <Input
              label={<span className="text-xs">Search</span>}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name or role"
              className="text-sm py-1.5"
            />
            <Select
              label={<span className="text-xs">Role</span>}
              value={role}
              onChange={e => setRole(e.target.value)}
              className="text-sm py-1.5"
            >
              <option value="">All roles</option>
              <option value="TALENT">TALENT</option>
              <option value="EDITOR">EDITOR</option>
              <option value="POSTING">POSTING</option>
            </Select>
            <Select
              label={<span className="text-xs">Active</span>}
              value={active}
              onChange={e => setActive(e.target.value)}
              className="text-sm py-1.5"
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                setSearch('');
                setRole('');
                setActive('true');
              }}
              className="text-sm py-1 px-2"
            >
              Reset Filters
            </Button>
            <RequirePermission permission={canManagePics}>
              <Button
                variant="primary"
                color="green"
                onClick={() => setShowAddForm(!showAddForm)}
                disabled={!!editingId}
                className="text-sm py-1 px-2"
              >
                {showAddForm ? 'Cancel' : 'Add PIC System'}
              </Button>
            </RequirePermission>
          </div>
        </div>
      </Card>
      <RequirePermission permission={canManagePics}>
        {(showAddForm || editingId) && (
          <Card className="mt-4">
            <h2 className="text-lg font-semibold mb-3">{editingId ? 'Edit PIC System' : 'Add PIC System'}</h2>
          <form onSubmit={editingId ? handleUpdatePic : handleAddPic} className="space-y-3">
            <Input
              label="Name"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              required
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
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting} className="flex-1" color={editingId ? 'blue' : 'green'}>
                {submitting ? (editingId ? 'Updating...' : 'Adding...') : (editingId ? 'Update PIC System' : 'Add PIC System')}
              </Button>
              <Button type="button" variant="outline" onClick={editingId ? handleCancelEdit : () => setShowAddForm(false)} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </form>
          </Card>
        )}
      </RequirePermission>
      <div className="mt-4">
        {loading ? (
          <div className="skeleton h-10 w-full" />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>PIC</TH>
                  <TH className="!text-center">Roles</TH>
                  <TH>Status</TH>
                  <TH className="!text-center">Actions</TH>
                </TR>
              </THead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <TR>
                    <TD colSpan={4} className="text-center py-6" style={{ color: 'var(--text-tertiary)' }}>
                      No PICs found
                    </TD>
                  </TR>
                ) : (
                  filteredItems.map(p => (
                    <TR key={p.id}>
                      <TD>
                        <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</div>
                      </TD>
                      <TD className="text-center">
                        {p.roles.length > 0 ? (
                          <div className="flex flex-wrap gap-1 justify-center">
                            {p.roles.map(roleName => (
                              <span key={roleName} className="text-xs px-2 py-0.5 rounded border" style={{ color: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderColor: '#93c5fd' }}>
                                {roleName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No roles</span>
                        )}
                      </TD>
                      <TD>
                        <span
                          className="badge border"
                          style={p.active ? {
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            borderColor: 'rgba(16, 185, 129, 0.3)',
                            color: '#10b981',
                          } : {
                            backgroundColor: 'var(--bg-tertiary)',
                            borderColor: 'var(--border-color)',
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          {p.active ? 'Active' : 'Inactive'}
                        </span>
                      </TD>
                      <TD>
                        <div className="flex gap-2 justify-center">
                          <RequirePermission permission={canManagePics}>
                            <Button variant="outline" color="blue" onClick={() => handleEditPic(p)} className="text-sm px-3 py-1.5">
                              Edit
                            </Button>
                          </RequirePermission>
                          <RequirePermission permission={canDelete}>
                            <Button
                              variant="outline"
                              color="red"
                              onClick={() => handleDeleteClick(p.id, p.name)}
                              disabled={deletingIds.has(p.id)}
                              className="text-sm px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {deletingIds.has(p.id) ? 'Deleting...' : 'Delete'}
                            </Button>
                          </RequirePermission>
                        </div>
                      </TD>
                    </TR>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </div>
      <Dialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete PIC"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="primary" color="red" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-700">
          Are you sure you want to delete <strong>"{deleteConfirm?.name}"</strong>?
        </p>
        <p className="text-sm text-gray-500 mt-2">
          This action cannot be undone.
        </p>
      </Dialog>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
