import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { formatDate } from '../lib/dateUtils';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import Toast from '../components/ui/Toast';
import PageHeader from '../components/PageHeader';
import { Table, TableWrap, THead, TH, TR, TD } from '../components/ui/Table';

type User = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'CAMPAIGN_MANAGER' | 'EDITOR' | 'VIEWER';
  createdAt: string;
};

export default function UsersPage() {
  const { token, user: currentUser } = useAuth();
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: '' as 'ADMIN' | 'CAMPAIGN_MANAGER' | 'EDITOR' | 'VIEWER' | '',
  });

  const fetchUsers = () => {
    setLoading(true);
    api('/users', { token })
      .then(setItems)
      .catch((error: any) => {
        setToast({ message: error?.error || 'Failed to fetch users', type: 'error' });
        setItems([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const resetForm = () => {
    setForm({
      name: '',
      email: '',
      password: '',
      role: '',
    });
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim() || !form.role) {
      setToast({ message: 'All fields are required', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      await api('/users', {
        method: 'POST',
        token,
        body: {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
        },
      });
      resetForm();
      setShowAddForm(false);
      fetchUsers();
      setToast({ message: 'User added successfully', type: 'success' });
    } catch (error: any) {
      setToast({ message: error?.error || 'Failed to add user', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingId(user.id);
    setForm({
      name: user.name,
      email: user.email,
      password: '', // Don't pre-fill password
      role: user.role,
    });
    setShowAddForm(false);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !form.name.trim() || !form.email.trim() || !form.role) {
      setToast({ message: 'Name, email, and role are required', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const updateData: any = {
        name: form.name,
        email: form.email,
        role: form.role,
      };
      // Only include password if provided
      if (form.password.trim()) {
        updateData.password = form.password;
      }
      await api(`/users/${editingId}`, {
        method: 'PUT',
        token,
        body: updateData,
      });
      resetForm();
      setEditingId(null);
      fetchUsers();
      setToast({ message: 'User updated successfully', type: 'success' });
    } catch (error: any) {
      setToast({ message: error?.error || 'Failed to update user', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    // Prevent deleting yourself
    if (id === currentUser?.id) {
      setToast({ message: 'You cannot delete your own account', type: 'error' });
      return;
    }
    setDeleteConfirm({ id, name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    
    // Prevent deleting yourself
    if (id === currentUser?.id) {
      setDeleteConfirm(null);
      setToast({ message: 'You cannot delete your own account', type: 'error' });
      return;
    }
    
    setDeletingIds(prev => new Set(prev).add(id));
    setDeleteConfirm(null);
    try {
      await api(`/users/${id}`, { method: 'DELETE', token });
      fetchUsers();
      setToast({ message: 'User deleted successfully', type: 'success' });
    } catch (error: any) {
      const errorMessage = error?.error || error?.message || 'Failed to delete user';
      setToast({ message: errorMessage, type: 'error' });
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

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return { color: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.1)', borderColor: '#fca5a5' };
      case 'CAMPAIGN_MANAGER':
        return { color: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderColor: '#93c5fd' };
      case 'EDITOR':
        return { color: '#16a34a', backgroundColor: 'rgba(22, 163, 74, 0.1)', borderColor: '#86efac' };
      case 'VIEWER':
        return { color: '#6b7280', backgroundColor: 'rgba(107, 114, 128, 0.1)', borderColor: '#d1d5db' };
      default:
        return { color: '#6b7280', backgroundColor: 'rgba(107, 114, 128, 0.1)', borderColor: '#d1d5db' };
    }
  };

  return (
    <div>
      <PageHeader
        backPath="/campaigns"
        backLabel="Back to campaigns"
        title={<h2 className="page-title">User Management</h2>}
      />
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Users</h2>
          <Button variant="primary" color="green" onClick={() => setShowAddForm(!showAddForm)} disabled={!!editingId}>
            {showAddForm ? 'Cancel' : 'Add User'}
          </Button>
        </div>
      </Card>
      {(showAddForm || editingId) && (
        <Card className="mt-4">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {editingId ? 'Edit User' : 'Add User'}
          </h2>
          <form onSubmit={editingId ? handleUpdateUser : handleAddUser} className="space-y-3">
            <Input
              label="Name"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              required
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
              required
            />
            <Input
              label={editingId ? 'New Password (leave blank to keep current)' : 'Password'}
              type="password"
              value={form.password}
              onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
              required={!editingId}
            />
            <Select
              label="Role"
              value={form.role}
              onChange={e => setForm(prev => ({ ...prev, role: e.target.value as any }))}
              required
            >
              <option value="">Select role</option>
              <option value="ADMIN">ADMIN</option>
              <option value="CAMPAIGN_MANAGER">CAMPAIGN_MANAGER</option>
              <option value="EDITOR">EDITOR</option>
              <option value="VIEWER">VIEWER</option>
            </Select>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting} className="flex-1" color={editingId ? 'blue' : 'green'}>
                {submitting ? (editingId ? 'Updating...' : 'Adding...') : (editingId ? 'Update User' : 'Add User')}
              </Button>
              <Button type="button" variant="outline" onClick={editingId ? handleCancelEdit : () => setShowAddForm(false)} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}
      <Card className="mt-4">
        {loading ? (
          <div className="skeleton h-10 w-full" />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Role</TH>
                  <TH>Created At</TH>
                  <TH>Actions</TH>
                </TR>
              </THead>
              <tbody>
                {items.map(user => {
                  const badgeStyle = getRoleBadgeColor(user.role);
                  const isCurrentUser = user.id === currentUser?.id;
                  return (
                    <TR key={user.id}>
                      <TD>
                        <div className="flex items-center gap-2">
                          <span style={{ color: 'var(--text-primary)' }}>{user.name}</span>
                          {isCurrentUser && (
                            <span className="text-xs px-2 py-0.5 rounded border" style={{ color: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderColor: '#93c5fd' }}>
                              You
                            </span>
                          )}
                        </div>
                      </TD>
                      <TD>
                        <span style={{ color: 'var(--text-secondary)' }}>{user.email}</span>
                      </TD>
                      <TD>
                        <span className="text-xs px-2 py-1 rounded border" style={badgeStyle}>
                          {user.role}
                        </span>
                      </TD>
                      <TD>
                        <span style={{ color: 'var(--text-tertiary)' }}>
                          {formatDate(user.createdAt)}
                        </span>
                      </TD>
                      <TD>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            color="blue"
                            onClick={() => handleEditUser(user)}
                            className="text-sm py-1.5"
                            disabled={!!editingId}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            color="red"
                            onClick={() => handleDeleteClick(user.id, user.name)}
                            disabled={deletingIds.has(user.id) || isCurrentUser || !!editingId}
                            className="text-sm py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deletingIds.has(user.id) ? 'Deleting...' : 'Delete'}
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
      <Dialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete User"
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
        <p style={{ color: 'var(--text-secondary)' }}>
          Are you sure you want to delete <strong>"{deleteConfirm?.name}"</strong>?
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
          This action cannot be undone. The user will be permanently removed from the system.
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

