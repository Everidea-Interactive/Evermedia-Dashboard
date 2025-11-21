import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { api } from '../lib/api';
import RequirePermission from '../components/RequirePermission';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Dialog from '../components/ui/Dialog';
import { TableWrap, Table, THead, TH, TR, TD } from '../components/ui/Table';
import PageHeader from '../components/PageHeader';

type Post = {
  id: string;
  campaignId: string;
  accountId: string;
  postDate: string;
  postDay: string;
  picTalentId?: string;
  picEditorId?: string;
  picPostingId?: string;
  picTalent?: { id: string; name: string } | null;
  picEditor?: { id: string; name: string } | null;
  picPosting?: { id: string; name: string } | null;
  account?: { id: string; name: string } | null;
  campaign?: { id: string; name: string } | null;
  contentCategory: string;
  adsOnMusic: boolean;
  yellowCart: boolean;
  postTitle: string;
  contentType: string;
  status: string;
  contentLink?: string;
  totalView: number;
  totalLike: number;
  totalComment: number;
  totalShare: number;
  totalSaved: number;
  engagementRate: number;
};

type CampaignOption = {
  id: string;
  name: string;
};

type PicOption = {
  id: string;
  name: string;
  roles: string[];
};

type AccountOption = {
  id: string;
  name: string;
};

type FilterState = {
  campaignId: string;
  accountId: string;
  status: string;
  category: string;
  dateFrom: string;
  dateTo: string;
  picTalentId: string;
  picEditorId: string;
  picPostingId: string;
};

const CONTENT_CATEGORY_OPTIONS = ['Hardsell product', 'Trend/FOMO', 'Berita/Event', 'Topik Sensitive', 'Sosok/Quotes/Film', 'Storytell', 'Edukasi Product'];
const STATUS_OPTIONS = ['On Going', 'Upload', 'Archive', 'Take Down'];

export default function AllPostsPage() {
  const { token } = useAuth();
  const { canEditPost, canDeletePost } = usePermissions();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [pics, setPics] = useState<PicOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<FilterState & { postTitle: string; contentType: string; contentLink: string; adsOnMusic: string; yellowCart: string; totalView: string; totalLike: string; totalComment: string; totalShare: string; totalSaved: string }>>({});
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    campaignId: '',
    accountId: '',
    status: '',
    category: '',
    dateFrom: '',
    dateTo: '',
    picTalentId: '',
    picEditorId: '',
    picPostingId: '',
  });

  const fetchPosts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.campaignId) params.append('campaignId', filters.campaignId);
      if (filters.accountId) params.append('accountId', filters.accountId);
      if (filters.status) params.append('status', filters.status);
      if (filters.category) params.append('category', filters.category);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.picTalentId) params.append('picTalentId', filters.picTalentId);
      if (filters.picEditorId) params.append('picEditorId', filters.picEditorId);
      if (filters.picPostingId) params.append('picPostingId', filters.picPostingId);

      const queryString = params.toString();
      const url = `/posts/all${queryString ? `?${queryString}` : ''}`;
      const data = await api(url, { token });
      setPosts(data as Post[]);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [token, filters]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    if (!token) return;
    api('/campaigns', { token }).then(setCampaigns).catch(() => {});
    api('/pics?active=true', { token }).then(setPics).catch(() => {});
    api('/accounts', { token }).then(setAccounts).catch(() => {});
  }, [token]);

  const talentPics = useMemo(() => pics.filter((pic) => pic.roles.some((role) => role.toUpperCase() === 'TALENT')), [pics]);
  const editorPics = useMemo(() => pics.filter((pic) => pic.roles.some((role) => role.toUpperCase() === 'EDITOR')), [pics]);
  const postingPics = useMemo(() => pics.filter((pic) => pic.roles.some((role) => role.toUpperCase() === 'POSTING')), [pics]);

  const handleFilterChange = (field: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditPost = (post: Post) => {
    setEditingPostId(post.id);
    setEditForm({
      campaignId: post.campaignId,
      picTalentId: post.picTalentId || '',
      picEditorId: post.picEditorId || '',
      picPostingId: post.picPostingId || '',
      contentCategory: post.contentCategory || '',
      contentType: post.contentType || '',
      status: post.status || '',
      contentLink: post.contentLink || '',
      postTitle: post.postTitle || '',
      postDate: post.postDate ? new Date(post.postDate).toISOString().split('T')[0] : '',
      adsOnMusic: post.adsOnMusic ? 'true' : 'false',
      yellowCart: post.yellowCart ? 'true' : 'false',
      totalView: post.totalView?.toString() ?? '',
      totalLike: post.totalLike?.toString() ?? '',
      totalComment: post.totalComment?.toString() ?? '',
      totalShare: post.totalShare?.toString() ?? '',
      totalSaved: post.totalSaved?.toString() ?? '',
    });
  };

  const handleUpdatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPostId) return;
    
    const post = posts.find(p => p.id === editingPostId);
    if (!post) return;

    setSubmittingEdit(true);
    try {
      const updatedPost = await api(`/posts/${editingPostId}`, {
        method: 'PUT',
        token,
        body: {
          postDate: editForm.postDate || post.postDate,
          picTalentId: editForm.picTalentId || undefined,
          picEditorId: editForm.picEditorId || undefined,
          picPostingId: editForm.picPostingId || undefined,
          contentCategory: editForm.contentCategory || undefined,
          adsOnMusic: editForm.adsOnMusic === 'true',
          yellowCart: editForm.yellowCart === 'true',
          postTitle: editForm.postTitle || post.postTitle,
          contentType: editForm.contentType || undefined,
          status: editForm.status || undefined,
          contentLink: editForm.contentLink || undefined,
          totalView: parseInt(editForm.totalView || '0', 10) || 0,
          totalLike: parseInt(editForm.totalLike || '0', 10) || 0,
          totalComment: parseInt(editForm.totalComment || '0', 10) || 0,
          totalShare: parseInt(editForm.totalShare || '0', 10) || 0,
          totalSaved: parseInt(editForm.totalSaved || '0', 10) || 0,
        },
      }) as Post;
      
      setPosts(prevPosts => prevPosts.map(p => {
        if (p.id === editingPostId) {
          const getPicObject = (picId: string | undefined) => {
            if (!picId) return null;
            const pic = pics.find(p => p.id === picId);
            return pic ? { id: pic.id, name: pic.name } : null;
          };
          
          return {
            ...updatedPost,
            account: post.account,
            campaign: post.campaign,
            picTalent: getPicObject(editForm.picTalentId),
            picEditor: getPicObject(editForm.picEditorId),
            picPosting: getPicObject(editForm.picPostingId),
            postDay: updatedPost.postDate ? new Date(updatedPost.postDate).toLocaleDateString('en-US', { weekday: 'long' }) : post.postDay,
          };
        }
        return p;
      }));
      
      setEditingPostId(null);
      setEditForm({});
      setToast({ type: 'success', text: 'Post updated successfully' });
    } catch (error) {
      setToast({ type: 'error', text: (error as Error).message });
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteClick = (post: Post) => {
    setDeleteConfirm({ id: post.id, title: post.postTitle });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeleting(true);
    try {
      await api(`/posts/${id}`, { method: 'DELETE', token });
      await fetchPosts();
      setToast({ type: 'success', text: 'Post deleted successfully' });
    } catch (error) {
      setToast({ type: 'error', text: (error as Error).message });
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div>
      <PageHeader
        backPath="/campaigns"
        backLabel="Back to campaigns"
        title={<h2 className="page-title">All Posts</h2>}
      />

      <Card className="mb-6">
        <div className="flex flex-col gap-1 mb-6">
          <div className="text-lg font-semibold">Filters</div>
          <p className="text-xs text-gray-500">Filter posts across all campaigns.</p>
        </div>
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <Select
                label="Campaign"
                value={filters.campaignId}
                onChange={(event) => handleFilterChange('campaignId', event.target.value)}
              >
                <option value="">All campaigns</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Select
                label="Account"
                value={filters.accountId}
                onChange={(event) => handleFilterChange('accountId', event.target.value)}
              >
                <option value="">All accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Select
                label="Status"
                value={filters.status}
                onChange={(event) => handleFilterChange('status', event.target.value)}
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <Select
                label="Content Category"
                value={filters.category}
                onChange={(event) => handleFilterChange('category', event.target.value)}
              >
                <option value="">All categories</option>
                {CONTENT_CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Select
                label="PIC Talent"
                value={filters.picTalentId}
                onChange={(event) => handleFilterChange('picTalentId', event.target.value)}
              >
                <option value="">All PICs</option>
                {talentPics.map((pic) => (
                  <option key={pic.id} value={pic.id}>
                    {pic.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Select
                label="PIC Editor"
                value={filters.picEditorId}
                onChange={(event) => handleFilterChange('picEditorId', event.target.value)}
              >
                <option value="">All Editors</option>
                {editorPics.map((pic) => (
                  <option key={pic.id} value={pic.id}>
                    {pic.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <Select
                label="PIC Posting"
                value={filters.picPostingId}
                onChange={(event) => handleFilterChange('picPostingId', event.target.value)}
              >
                <option value="">All Posting PICs</option>
                {postingPics.map((pic) => (
                  <option key={pic.id} value={pic.id}>
                    {pic.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Input
                label="Date From"
                type="date"
                value={filters.dateFrom}
                onChange={(event) => handleFilterChange('dateFrom', event.target.value)}
              />
            </div>
            <div>
              <Input
                label="Date To"
                type="date"
                value={filters.dateTo}
                onChange={(event) => handleFilterChange('dateTo', event.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button
              onClick={() => {
                setFilters({
                  campaignId: '',
                  accountId: '',
                  status: '',
                  category: '',
                  dateFrom: '',
                  dateTo: '',
                  picTalentId: '',
                  picEditorId: '',
                  picPostingId: '',
                });
              }}
              variant="outline"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="skeleton h-10 w-full" />
      ) : posts.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <p className="text-gray-500 text-lg">No posts found</p>
            <p className="text-gray-400 text-sm mt-2">
              {Object.values(filters).some(f => f !== '') 
                ? 'Try adjusting your filters to see more results.'
                : 'There are no posts available. Create a new post to get started.'}
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="card-inner-table">
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>NO</TH>
                    <TH className="!text-center">Actions</TH>
                    <TH>Campaign</TH>
                    <TH>Account</TH>
                    <TH>Hari Posting</TH>
                    <TH>Tanggal Posting</TH>
                    <TH>Judul</TH>
                    <TH>Jenis</TH>
                    <TH>Kategori Konten</TH>
                    <TH>Status</TH>
                    <TH>PIC Talent</TH>
                    <TH>PIC Editor</TH>
                    <TH>PIC Posting</TH>
                    <TH>Content Link</TH>
                    <TH>Ads on Music</TH>
                    <TH>Keranjang Kuning</TH>
                    <TH>TOTAL VIEW</TH>
                    <TH>LIKE</TH>
                    <TH>COMMENT</TH>
                    <TH>SHARE</TH>
                    <TH>SAVED</TH>
                    <TH>Engagement Rate</TH>
                  </TR>
                </THead>
                <tbody>
                  {posts.map((p, i) => {
                    const picTalentName = p.picTalent?.name || (p.picTalentId ? pics.find(pic => pic.id === p.picTalentId)?.name : null) || '—';
                    const picEditorName = p.picEditor?.name || (p.picEditorId ? pics.find(pic => pic.id === p.picEditorId)?.name : null) || '—';
                    const picPostingName = p.picPosting?.name || (p.picPostingId ? pics.find(pic => pic.id === p.picPostingId)?.name : null) || '—';
                    const accountName = p.account?.name || (p.accountId ? accounts.find(acc => acc.id === p.accountId)?.name : null) || '—';
                    const campaignName = p.campaign?.name || (p.campaignId ? campaigns.find(c => c.id === p.campaignId)?.name : null) || '—';
                    return (
                      <TR key={p.id}>
                        <TD>{i + 1}</TD>
                        <TD>
                          <div className="flex gap-1.5 justify-center">
                            <RequirePermission permission={canEditPost}>
                              <Button
                                onClick={() => handleEditPost(p)}
                                variant="ghost"
                                color="blue"
                                className="text-xs px-2 py-1"
                                type="button"
                              >
                                Edit
                              </Button>
                            </RequirePermission>
                            <RequirePermission permission={canDeletePost}>
                              <Button
                                onClick={() => handleDeleteClick(p)}
                                variant="ghost"
                                color="red"
                                className="text-xs px-2 py-1"
                                type="button"
                              >
                                Delete
                              </Button>
                            </RequirePermission>
                          </div>
                        </TD>
                        <TD>
                          {campaignName !== '—' ? (
                            <Link to={`/campaigns/${p.campaignId}`} className="hover:underline" style={{ color: '#2563eb' }}>
                              {campaignName}
                            </Link>
                          ) : (
                            campaignName
                          )}
                        </TD>
                        <TD>{accountName}</TD>
                        <TD>{p.postDay}</TD>
                        <TD>{new Date(p.postDate).toLocaleDateString()}</TD>
                        <TD>{p.postTitle}</TD>
                        <TD>{p.contentType}</TD>
                        <TD>{p.contentCategory}</TD>
                        <TD>
                          <span className="badge">{p.status}</span>
                        </TD>
                        <TD>{picTalentName}</TD>
                        <TD>{picEditorName}</TD>
                        <TD>{picPostingName}</TD>
                        <TD>
                          {p.contentLink ? (
                            <a href={p.contentLink} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: '#2563eb' }}>
                              Link
                            </a>
                          ) : '—'}
                        </TD>
                        <TD>{p.adsOnMusic ? 'Yes' : 'No'}</TD>
                        <TD>{p.yellowCart ? 'Yes' : 'No'}</TD>
                        <TD>{p.totalView}</TD>
                        <TD>{p.totalLike}</TD>
                        <TD>{p.totalComment}</TD>
                        <TD>{p.totalShare}</TD>
                        <TD>{p.totalSaved}</TD>
                        <TD>{(p.engagementRate * 100).toFixed(2)}%</TD>
                      </TR>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          </div>
        </Card>
      )}

      <Dialog
        open={!!editingPostId}
        onClose={() => {
          setEditingPostId(null);
          setEditForm({});
        }}
        title="Edit Post"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setEditingPostId(null);
                setEditForm({});
              }}
              disabled={submittingEdit}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdatePost} disabled={submittingEdit} color="blue">
              {submittingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleUpdatePost} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <Input
                label="Post Title"
                value={editForm.postTitle || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, postTitle: e.target.value }))}
                required
              />
            </div>
            <div>
              <Input
                label="Post Date"
                type="date"
                value={editForm.postDate || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, postDate: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <Select
                label="Content Type"
                value={editForm.contentType || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, contentType: e.target.value }))}
              >
                <option value="">Select type</option>
                <option value="Slide">Slide</option>
                <option value="Video">Video</option>
              </Select>
            </div>
            <div>
              <Select
                label="Content Category"
                value={editForm.contentCategory || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, contentCategory: e.target.value }))}
              >
                <option value="">Select content category</option>
                {CONTENT_CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <Select
                label="PIC Content"
                value={editForm.picTalentId || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, picTalentId: e.target.value }))}
              >
                <option value="">Select PIC</option>
                {talentPics.map((pic) => (
                  <option key={pic.id} value={pic.id}>
                    {pic.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Select
                label="PIC Editor"
                value={editForm.picEditorId || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, picEditorId: e.target.value }))}
              >
                <option value="">Select Editor</option>
                {editorPics.map((pic) => (
                  <option key={pic.id} value={pic.id}>
                    {pic.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Select
                label="PIC Posting"
                value={editForm.picPostingId || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, picPostingId: e.target.value }))}
              >
                <option value="">Select Posting</option>
                {postingPics.map((pic) => (
                  <option key={pic.id} value={pic.id}>
                    {pic.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <Select
                label="Status"
                value={editForm.status || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="">Select status</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Select
                label="Ads On Music"
                value={editForm.adsOnMusic || 'false'}
                onChange={(e) => setEditForm(prev => ({ ...prev, adsOnMusic: e.target.value }))}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </Select>
            </div>
            <div>
              <Select
                label="Yellow Cart"
                value={editForm.yellowCart || 'false'}
                onChange={(e) => setEditForm(prev => ({ ...prev, yellowCart: e.target.value }))}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </Select>
            </div>
          </div>
          <div>
            <Input
              label="Content Link"
              placeholder="https://..."
              value={editForm.contentLink || ''}
              onChange={(e) => setEditForm(prev => ({ ...prev, contentLink: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-5">
            <div>
              <Input
                label="Views"
                value={editForm.totalView ?? ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, totalView: e.target.value }))}
              />
            </div>
            <div>
              <Input
                label="Likes"
                value={editForm.totalLike ?? ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, totalLike: e.target.value }))}
              />
            </div>
            <div>
              <Input
                label="Comments"
                value={editForm.totalComment ?? ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, totalComment: e.target.value }))}
              />
            </div>
            <div>
              <Input
                label="Shares"
                value={editForm.totalShare ?? ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, totalShare: e.target.value }))}
              />
            </div>
            <div>
              <Input
                label="Saved"
                value={editForm.totalSaved ?? ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, totalSaved: e.target.value }))}
              />
            </div>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Post"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              color="red"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)' }}>
          Are you sure you want to delete <strong>"{deleteConfirm?.title}"</strong>?
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
          This action cannot be undone. KPIs will be recalculated automatically after deletion.
        </p>
      </Dialog>

      {toast && (
        <div className="fixed inset-x-0 bottom-4 flex justify-center px-4 pointer-events-none z-50">
          <div
            className={`pointer-events-auto max-w-md w-full rounded-lg border px-4 py-3 text-sm shadow-lg ${
              toast.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {toast.text}
          </div>
        </div>
      )}
    </div>
  );
}

