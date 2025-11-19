import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { api } from '../lib/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Toast from '../components/ui/Toast';
import RequirePermission from '../components/RequirePermission';
import { TableWrap, Table, THead, TH, TR, TD } from '../components/ui/Table';
import PageHeader from '../components/PageHeader';
import EngagementVisualizer from '../components/EngagementVisualizer';

const statusPills: Record<string, { bg: string; border: string; text: string }> = {
  ACTIVE: { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)', text: '#10b981' },
  PLANNED: { bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.3)', text: '#eab308' },
  PAUSED: { bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.3)', text: '#f97316' },
  COMPLETED: { bg: 'var(--bg-tertiary)', border: 'var(--border-color)', text: 'var(--text-secondary)' },
};

const accountCategoryOrder = ['VIEWS', 'QTY_POST', 'FYP_COUNT', 'VIDEO_COUNT', 'GMV_IDR', 'YELLOW_CART'];
const categoryLabels: Record<string, string> = {
  VIEWS: 'Views',
  QTY_POST: 'Qty Post',
  FYP_COUNT: 'FYP Count',
  VIDEO_COUNT: 'Video Count',
  GMV_IDR: 'GMV (IDR)',
  YELLOW_CART: 'Yellow Cart',
};

export default function CampaignDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { canManageCampaigns, canDelete, canEditPost } = usePermissions();
  const [campaign, setCampaign] = useState<any>(null);
  const [engagement, setEngagement] = useState<any>(null);
  const [kpis, setKpis] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [accountRemoving, setAccountRemoving] = useState<Record<string, boolean>>({});
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [pics, setPics] = useState<any[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (!id) return;
    api(`/campaigns/${id}`, { token }).then(setCampaign);
    api(`/campaigns/${id}/dashboard/engagement`, { token }).then(setEngagement);
    api(`/campaigns/${id}/kpis`, { token }).then(setKpis);
    api(`/campaigns/${id}/posts`, { token }).then(setPosts);
    api('/pics?active=true', { token }).then(setPics).catch(() => {});
  }, [id, token]);

  const handleAccountRemove = async (accountId: string) => {
    if (!id) return;
    setAccountRemoving((prev) => ({ ...prev, [accountId]: true }));
    try {
      await api(`/campaigns/${id}/accounts/${accountId}`, { method: 'DELETE', token });
      const refreshed = await api(`/campaigns/${id}`, { token });
      setCampaign(refreshed);
      setToast({ message: 'Account removed successfully', type: 'success' });
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to remove account', type: 'error' });
    } finally {
      setAccountRemoving((prev) => ({ ...prev, [accountId]: false }));
    }
  };

  const handleDeleteCampaign = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await api(`/campaigns/${id}`, { method: 'DELETE', token });
      navigate('/campaigns');
    } catch (error: any) {
      alert(error?.error || 'Failed to delete campaign');
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  const totalViews = useMemo(() => posts.reduce((acc, p) => acc + (p.totalView ?? 0), 0), [posts]);
  const totalLikes = useMemo(() => posts.reduce((acc, p) => acc + (p.totalLike ?? 0), 0), [posts]);
  const campaignKpiSummary = useMemo(() => {
    const map = new Map<string, { target: number; actual: number }>();
    // Only include campaign-level KPIs (where accountId is null)
    kpis.filter((k) => !k.accountId).forEach((k) => {
      const existing = map.get(k.category) ?? { target: 0, actual: 0 };
      map.set(k.category, { target: existing.target + (k.target ?? 0), actual: existing.actual + (k.actual ?? 0) });
    });
    return map;
  }, [kpis]);

  const accountKpiMap = useMemo(() => {
    const map = new Map<string, Record<string, { target: number; actual: number }>>();
    kpis.forEach((k) => {
      if (!k.accountId) return;
      if (!map.has(k.accountId)) map.set(k.accountId, {});
      
      // For QTY_POST, calculate actual from posts for current campaign only
      if (k.category === 'QTY_POST') {
        const postCount = posts.filter((p: any) => p.accountId === k.accountId).length;
        map.get(k.accountId)![k.category] = { target: k.target ?? 0, actual: postCount };
      } else {
        map.get(k.accountId)![k.category] = { target: k.target ?? 0, actual: k.actual ?? 0 };
      }
    });
    return map;
  }, [kpis, posts]);

  const backPath = '/campaigns';

  if (!campaign) {
    return (
      <div>
        <PageHeader backPath={backPath} backLabel="Back to campaigns" title={<div className="page-title">Loading…</div>} />
        <div className="mt-3">Loading…</div>
      </div>
    );
  }

  const headerMeta = (
    <div className="flex flex-wrap gap-1">
      {Array.isArray(campaign.categories) && campaign.categories.length > 0 ? (
        campaign.categories.map((cat: string, idx: number) => (
          <span key={idx} className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', color: '#6366f1' }}>
            {cat}
          </span>
        ))
      ) : (
        <span style={{ color: 'var(--text-tertiary)' }}>No categories</span>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        backPath={backPath}
        backLabel="Back to campaigns"
        title={
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-start">
            <h1 className="page-title text-xl sm:text-2xl">{campaign.name}</h1>
            <span 
              className="badge border text-xs sm:text-sm" 
              style={statusPills[campaign.status] ? {
                backgroundColor: statusPills[campaign.status].bg,
                borderColor: statusPills[campaign.status].border,
                color: statusPills[campaign.status].text
              } : {}}
            >
              {campaign.status}
            </span>
          </div>
        }
        meta={headerMeta}
        action={
          <div className="flex gap-2 flex-wrap w-full sm:w-auto">
            <RequirePermission permission={canManageCampaigns}>
              <Link
                to={`/campaigns/${campaign.id}/edit`}
                className="btn btn-outline-blue text-xs sm:text-sm whitespace-nowrap flex-1 sm:flex-none"
              >
                Edit campaign
              </Link>
            </RequirePermission>
            <RequirePermission permission={canDelete}>
              <Button
                variant="outline"
                color="red"
                onClick={() => setDeleteConfirm(true)}
                disabled={deleting}
                className="text-xs sm:text-sm whitespace-nowrap flex-1 sm:flex-none"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </RequirePermission>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-4 sm:mb-6">
        <Card>
          <div className="section-title text-xs sm:text-sm">Views</div>
          <div className="mt-1 text-lg sm:text-2xl font-semibold">{engagement?.views?.toLocaleString() ?? '-'}</div>
        </Card>
        <Card>
          <div className="section-title text-xs sm:text-sm">Likes</div>
          <div className="mt-1 text-lg sm:text-2xl font-semibold">{engagement?.likes?.toLocaleString() ?? '-'}</div>
        </Card>
        <Card>
          <div className="section-title text-xs sm:text-sm">Comments</div>
          <div className="mt-1 text-lg sm:text-2xl font-semibold">{engagement?.comments?.toLocaleString() ?? '-'}</div>
        </Card>
        <Card>
          <div className="section-title text-xs sm:text-sm">Shares</div>
          <div className="mt-1 text-lg sm:text-2xl font-semibold">{engagement?.shares?.toLocaleString() ?? '-'}</div>
        </Card>
        <Card>
          <div className="section-title text-xs sm:text-sm">Saved</div>
          <div className="mt-1 text-lg sm:text-2xl font-semibold">{engagement?.saves?.toLocaleString() ?? '-'}</div>
        </Card>
        <Card>
          <div className="section-title text-xs sm:text-sm">Engagement Rate</div>
          <div className="mt-1 text-lg sm:text-2xl font-semibold">{engagement?.engagementRate ? (engagement.engagementRate * 100).toFixed(2) + '%' : '-'}</div>
        </Card>
      </div>

      <section className="mb-4 sm:mb-6">
        <Card>
          <div className="flex items-center justify-between mb-3 px-2 sm:px-0">
            <h2 className="text-base sm:text-lg font-semibold">Campaign KPIs</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 px-2 sm:px-0 pb-2 sm:pb-0">
            {accountCategoryOrder.map((cat) => {
              const kpi = campaignKpiSummary.get(cat);
              const target = kpi?.target ?? 0;
              const actual = kpi?.actual ?? 0;
              const isAchieved = target > 0 && actual >= target;
              return (
                <div 
                  key={cat} 
                  className="rounded-lg border p-2 text-center" 
                  style={{ 
                    borderColor: isAchieved ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)', 
                    backgroundColor: isAchieved ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-tertiary)' 
                  }}
                >
                  <div className="text-[9px] sm:text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{categoryLabels[cat]}</div>
                  <div className="text-xs sm:text-sm font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>{actual.toLocaleString()}/{target.toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <section className="mb-4 sm:mb-6">
        <Card>
          <div className="mb-3 sm:mb-4 px-2 sm:px-0">
            <h2 className="text-base sm:text-lg font-semibold">Engagement Analytics</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
              Visual breakdown of campaign engagement metrics
            </p>
          </div>
          <div className="px-2 sm:px-0 pb-2 sm:pb-0">
            <EngagementVisualizer engagement={engagement} posts={posts} />
          </div>
        </Card>
      </section>

      <section className="mb-4 sm:mb-6">
        <Card>
          <div className="flex items-center justify-between mb-3 px-2 sm:px-0">
            <h2 className="text-base sm:text-lg font-semibold">Accounts</h2>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{(campaign.accounts || []).length}</span>
          </div>
          <div className="grid gap-3 max-h-[420px] overflow-y-auto pr-1 px-2 sm:px-0 pb-2 sm:pb-0">
            {(campaign.accounts || []).map((account: any) => (
              <div key={account.id} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 border border-dashed rounded-lg px-3 sm:px-4 py-3" style={{ borderColor: 'var(--border-color)' }}>
                <div className="flex-1 min-w-0 sm:min-w-[150px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium text-sm sm:text-base truncate">{account.name}</div>
                    <span className="text-[10px] sm:text-[11px] uppercase tracking-wide whitespace-nowrap flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{account.accountType}</span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{account.tiktokHandle ?? '—'}</div>
                </div>
                <div className="grid grid-cols-2 sm:flex sm:flex-nowrap items-center sm:justify-end gap-2 text-[10px] uppercase tracking-wide sm:flex-1 sm:min-w-0" style={{ color: 'var(--text-tertiary)' }}>
                  {accountCategoryOrder.map((cat) => {
                    const entry = accountKpiMap.get(account.id)?.[cat];
                    const isAchieved = entry && entry.target > 0 && entry.actual >= entry.target;
                    return (
                      <div 
                        key={cat} 
                        className="flex min-w-[70px] sm:min-w-[80px] flex-col items-center rounded-lg border px-1.5 sm:px-2 py-1 text-center" 
                        style={{ 
                          borderColor: isAchieved ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)', 
                          backgroundColor: isAchieved ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-tertiary)' 
                        }}
                      >
                        <div className="text-[8px] sm:text-[9px] whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>{categoryLabels[cat]}</div>
                        <div className="text-xs sm:text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{entry ? `${entry.actual}/${entry.target}` : '0 / 0'}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-stretch sm:items-center gap-2 sm:whitespace-nowrap sm:flex-shrink-0">
                  <Link to={`/campaigns/${campaign.id}/accounts/${account.id}/edit`} className="btn btn-outline-blue text-xs px-2 sm:px-3 py-1.5 sm:py-1 flex-1 sm:flex-none text-center">
                    Edit KPIs
                  </Link>
                  <Button variant="ghost" color="red" className="text-xs px-2 sm:px-3 py-1.5 sm:py-1 flex-1 sm:flex-none" onClick={() => handleAccountRemove(account.id)} disabled={accountRemoving[account.id]}>
                    {accountRemoving[account.id] ? 'Removing…' : 'Remove'}
                  </Button>
                </div>
              </div>
            ))}
            {(campaign.accounts || []).length === 0 && <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No linked accounts.</div>}
          </div>
        </Card>
      </section>

      <section className="mt-4 sm:mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3">
          <div>
            <h2 className="text-base sm:text-lg font-semibold">Posts overview</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{posts.length} posts · {totalViews.toLocaleString()} views · {totalLikes.toLocaleString()} likes</p>
          </div>
          <Link to={`/campaigns/${campaign.id}/posts`} className="text-xs sm:text-sm hover:underline transition-colors self-start sm:self-auto" style={{ color: '#6366f1' }}>
            View all posts
          </Link>
        </div>
        <Card>
          <div className="card-inner-table">
            {posts.length === 0 ? (
              <div className="text-sm p-4 sm:p-6" style={{ color: 'var(--text-tertiary)' }}>No posts yet.</div>
            ) : (
              <TableWrap>
                  <Table>
                    <THead>
                      <TR>
                        <TH>NO</TH>
                        <TH>Actions</TH>
                        <TH>Account</TH>
                        <TH>Tanggal Posting</TH>
                        <TH>Judul</TH>
                        <TH>Jenis</TH>
                        <TH>Kategori Konten</TH>
                        <TH>PIC Talent</TH>
                        <TH>PIC Editor</TH>
                        <TH>PIC Posting</TH>
                        <TH>Content Link</TH>
                        <TH>Ads on Music</TH>
                        <TH>Yellow Cart</TH>
                        <TH>Status</TH>
                        <TH>Views</TH>
                        <TH>Likes</TH>
                        <TH>Comments</TH>
                        <TH>Shares</TH>
                        <TH>Saved</TH>
                        <TH>Engagement</TH>
                      </TR>
                    </THead>
                    <tbody>
                      {posts.map((p: any, index) => (
                        <TR key={p.id}>
                          <TD>{index + 1}</TD>
                          <TD>
                            <RequirePermission permission={canEditPost}>
                              <Button
                                onClick={() => {
                                  setEditingPostId(p.id);
                                  setEditForm({
                                    postTitle: p.postTitle || '',
                                    postDate: p.postDate ? new Date(p.postDate).toISOString().split('T')[0] : '',
                                    contentType: p.contentType || '',
                                    contentCategory: p.contentCategory || '',
                                    status: p.status || '',
                                    picTalentId: p.picTalentId || '',
                                    picEditorId: p.picEditorId || '',
                                    picPostingId: p.picPostingId || '',
                                    contentLink: p.contentLink || '',
                                    adsOnMusic: p.adsOnMusic ? 'true' : 'false',
                                    yellowCart: p.yellowCart ? 'true' : 'false',
                                    totalView: p.totalView?.toString() ?? '',
                                    totalLike: p.totalLike?.toString() ?? '',
                                    totalComment: p.totalComment?.toString() ?? '',
                                    totalShare: p.totalShare?.toString() ?? '',
                                    totalSaved: p.totalSaved?.toString() ?? '',
                                  });
                                }}
                                variant="ghost"
                                color="blue"
                                className="text-xs px-2 py-1"
                                type="button"
                              >
                                Edit
                              </Button>
                            </RequirePermission>
                          </TD>
                          <TD>{p.account?.name || '—'}</TD>
                          <TD>{new Date(p.postDate).toLocaleDateString()}</TD>
                          <TD>{p.postTitle}</TD>
                          <TD>{p.contentType}</TD>
                          <TD>{p.contentCategory || '—'}</TD>
                          <TD>{p.picTalent?.name || '—'}</TD>
                          <TD>{p.picEditor?.name || '—'}</TD>
                          <TD>{p.picPosting?.name || '—'}</TD>
                          <TD>
                            {p.contentLink ? (
                              <a href={p.contentLink} target="_blank" rel="noopener noreferrer" className="hover:underline transition-colors" style={{ color: '#6366f1' }}>
                                Link
                              </a>
                            ) : '—'}
                          </TD>
                          <TD>{p.adsOnMusic ? 'Yes' : 'No'}</TD>
                          <TD>{p.yellowCart ? 'Yes' : 'No'}</TD>
                          <TD>
                            <span className="badge">{p.status}</span>
                          </TD>
                          <TD>{p.totalView}</TD>
                          <TD>{p.totalLike}</TD>
                          <TD>{p.totalComment}</TD>
                          <TD>{p.totalShare}</TD>
                          <TD>{p.totalSaved}</TD>
                          <TD>{((p.engagementRate ?? 0) * 100).toFixed(2)}%</TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
            )}
          </div>
        </Card>
      </section>

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
            <Button
              onClick={async (e: FormEvent) => {
                e.preventDefault();
                if (!editingPostId) return;
                const post = posts.find((p: any) => p.id === editingPostId);
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
                  }) as any;
                  
                  // Helper to get PIC object or null
                  const getPicObject = (picId: string | undefined) => {
                    if (!picId) return null;
                    const pic = pics.find((p: any) => p.id === picId);
                    return pic ? { id: pic.id, name: pic.name } : null;
                  };
                  
                  // Update the post in the list without reloading all posts
                  setPosts(prevPosts => prevPosts.map((p: any) => {
                    if (p.id === editingPostId) {
                      // Preserve account, campaign, and update PIC objects from form
                      return {
                        ...updatedPost,
                        account: p.account,
                        campaign: p.campaign,
                        picTalent: getPicObject(editForm.picTalentId),
                        picEditor: getPicObject(editForm.picEditorId),
                        picPosting: getPicObject(editForm.picPostingId),
                        postDay: updatedPost.postDate ? new Date(updatedPost.postDate).toLocaleDateString('en-US', { weekday: 'long' }) : p.postDay,
                      };
                    }
                    return p;
                  }));
                  
                  // Only refresh KPIs and engagement, not posts
                  const [refreshedKpis, refreshedEngagement] = await Promise.all([
                    api(`/campaigns/${id}/kpis`, { token }),
                    api(`/campaigns/${id}/dashboard/engagement`, { token }),
                  ]);
                  setKpis(refreshedKpis);
                  setEngagement(refreshedEngagement);
                  
                  setEditingPostId(null);
                  setEditForm({});
                } catch (error: any) {
                  alert(error?.error || 'Failed to update post');
                } finally {
                  setSubmittingEdit(false);
                }
              }}
              disabled={submittingEdit}
              color="blue"
            >
              {submittingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <Input
                label="Post Title"
                value={editForm.postTitle || ''}
                onChange={(e) => setEditForm((prev: any) => ({ ...prev, postTitle: e.target.value }))}
                required
              />
            </div>
            <div>
              <Input
                label="Post Date"
                type="date"
                value={editForm.postDate || ''}
                onChange={(e) => setEditForm((prev: any) => ({ ...prev, postDate: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <Select
                label="Content Type"
                value={editForm.contentType || ''}
                onChange={(e) => setEditForm((prev: any) => ({ ...prev, contentType: e.target.value }))}
              >
                <option value="">Select type</option>
                <option value="Video">Video</option>
                <option value="Photo">Photo</option>
                <option value="Reel">Reel</option>
                <option value="Live">Live</option>
                <option value="Story">Story</option>
              </Select>
            </div>
            <div>
              <Select
                label="Content Category"
                value={editForm.contentCategory || ''}
                onChange={(e) => setEditForm((prev: any) => ({ ...prev, contentCategory: e.target.value }))}
              >
                <option value="">Select content category</option>
                <option value="Teaser">Teaser</option>
                <option value="BTS">BTS</option>
                <option value="Product Highlight">Product Highlight</option>
                <option value="Tutorial">Tutorial</option>
                <option value="Story">Story</option>
                <option value="Review">Review</option>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <Select
                label="PIC Talent"
                value={editForm.picTalentId || ''}
                onChange={(e) => setEditForm((prev: any) => ({ ...prev, picTalentId: e.target.value }))}
              >
                <option value="">Select PIC</option>
                {pics.filter((pic: any) => pic.roles?.some((r: string) => r.toUpperCase() === 'TALENT')).map((pic: any) => (
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
                onChange={(e) => setEditForm((prev: any) => ({ ...prev, picEditorId: e.target.value }))}
              >
                <option value="">Select Editor</option>
                {pics.filter((pic: any) => pic.roles?.some((r: string) => r.toUpperCase() === 'EDITOR')).map((pic: any) => (
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
                onChange={(e) => setEditForm((prev: any) => ({ ...prev, picPostingId: e.target.value }))}
              >
                <option value="">Select Posting</option>
                {pics.filter((pic: any) => pic.roles?.some((r: string) => r.toUpperCase() === 'POSTING')).map((pic: any) => (
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
                onChange={(e) => setEditForm((prev: any) => ({ ...prev, status: e.target.value }))}
              >
                <option value="">Select status</option>
                <option value="PLANNED">PLANNED</option>
                <option value="SCHEDULED">SCHEDULED</option>
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </Select>
            </div>
            <div>
              <Select
                label="Ads On Music"
                value={editForm.adsOnMusic || 'false'}
                onChange={(e) => setEditForm((prev: any) => ({ ...prev, adsOnMusic: e.target.value }))}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </Select>
            </div>
            <div>
              <Select
                label="Yellow Cart"
                value={editForm.yellowCart || 'false'}
                onChange={(e) => setEditForm((prev: any) => ({ ...prev, yellowCart: e.target.value }))}
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
              onChange={(e) => setEditForm((prev: any) => ({ ...prev, contentLink: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-5">
            <div>
              <Input
                label="Views"
                value={editForm.totalView ?? ''}
                onChange={(e) => setEditForm((prev: any) => ({ ...prev, totalView: e.target.value }))}
              />
            </div>
            <div>
              <Input
                label="Likes"
                value={editForm.totalLike ?? ''}
                onChange={(e) => setEditForm((prev: any) => ({ ...prev, totalLike: e.target.value }))}
              />
            </div>
            <div>
              <Input
                label="Comments"
                value={editForm.totalComment ?? ''}
                onChange={(e) => setEditForm((prev: any) => ({ ...prev, totalComment: e.target.value }))}
              />
            </div>
            <div>
              <Input
                label="Shares"
                value={editForm.totalShare ?? ''}
                onChange={(e) => setEditForm((prev: any) => ({ ...prev, totalShare: e.target.value }))}
              />
            </div>
            <div>
              <Input
                label="Saved"
                value={editForm.totalSaved ?? ''}
                onChange={(e) => setEditForm((prev: any) => ({ ...prev, totalSaved: e.target.value }))}
              />
            </div>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        title="Delete Campaign"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteConfirm(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="primary" color="red" onClick={handleDeleteCampaign} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)' }}>
          Are you sure you want to delete <strong>"{campaign?.name}"</strong>?
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
          This action cannot be undone. All associated posts, KPIs, and account links will also be deleted.
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
