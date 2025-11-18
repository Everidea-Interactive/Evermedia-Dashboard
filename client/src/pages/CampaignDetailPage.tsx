import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { TableWrap, Table, THead, TH, TR, TD } from '../components/ui/Table';
import PageHeader from '../components/PageHeader';

const statusPills: Record<string, string> = {
  ACTIVE: 'bg-green-50 border-green-100 text-green-700',
  PLANNED: 'bg-yellow-50 border-yellow-100 text-yellow-700',
  PAUSED: 'bg-orange-50 border-orange-100 text-orange-700',
  COMPLETED: 'bg-gray-50 border-gray-100 text-gray-600',
};

const accountCategoryOrder = ['VIEWS', 'QTY_POST', 'FYP_COUNT', 'VIDEO_COUNT', 'GMV_IDR'];
const categoryLabels: Record<string, string> = {
  VIEWS: 'Views',
  QTY_POST: 'Qty Post',
  FYP_COUNT: 'FYP Count',
  VIDEO_COUNT: 'Video Count',
  GMV_IDR: 'GMV (IDR)',
};

export default function CampaignDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [campaign, setCampaign] = useState<any>(null);
  const [engagement, setEngagement] = useState<any>(null);
  const [kpis, setKpis] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [accountRemoving, setAccountRemoving] = useState<Record<string, boolean>>({});
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [pics, setPics] = useState<any[]>([]);

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
    } finally {
      setAccountRemoving((prev) => ({ ...prev, [accountId]: false }));
    }
  };

  const totalViews = useMemo(() => posts.reduce((acc, p) => acc + (p.totalView ?? 0), 0), [posts]);
  const totalLikes = useMemo(() => posts.reduce((acc, p) => acc + (p.totalLike ?? 0), 0), [posts]);
  const campaignKpiSummary = useMemo(() => {
    const map = new Map<string, { target: number; actual: number }>();
    kpis.forEach((k) => {
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
      map.get(k.accountId)![k.category] = { target: k.target, actual: k.actual };
    });
    return map;
  }, [kpis]);

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
    <>
      <div className="flex flex-wrap gap-1">
        {Array.isArray(campaign.categories) && campaign.categories.length > 0 ? (
          campaign.categories.map((cat: string, idx: number) => (
            <span key={idx} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded">
              {cat}
            </span>
          ))
        ) : (
          <span className="text-gray-400">No categories</span>
        )}
      </div>
      <span className={`badge border ${statusPills[campaign.status] ?? ''}`}>{campaign.status}</span>
    </>
  );

  return (
    <div>
      <PageHeader
        backPath={backPath}
        backLabel="Back to campaigns"
        title={<h1 className="page-title">{campaign.name}</h1>}
        meta={headerMeta}
        action={
          <Link
            to={`/campaigns/${campaign.id}/edit`}
            className="btn btn-outline text-sm whitespace-nowrap"
          >
            Edit campaign
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card>
          <div className="section-title">Views</div>
          <div className="mt-1 text-2xl font-semibold">{engagement?.views ?? '-'}</div>
        </Card>
        <Card>
          <div className="section-title">Likes</div>
          <div className="mt-1 text-2xl font-semibold">{engagement?.likes ?? '-'}</div>
        </Card>
        <Card>
          <div className="section-title">Comments</div>
          <div className="mt-1 text-2xl font-semibold">{engagement?.comments ?? '-'}</div>
        </Card>
        <Card>
          <div className="section-title">Engagement Rate</div>
          <div className="mt-1 text-2xl font-semibold">{engagement?.engagementRate ?? '-'}</div>
        </Card>
      </div>

      <section className="grid gap-4 mb-6">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Campaign KPIs</h2>
            <span className="text-xs text-gray-500">{kpis.length} tracked</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {accountCategoryOrder.map((cat) => {
              const kpi = campaignKpiSummary.get(cat);
              const target = kpi?.target ?? 0;
              const actual = kpi?.actual ?? 0;
              return (
                <div key={cat} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">{categoryLabels[cat]}</div>
                  <div className="text-sm font-semibold text-gray-800 mt-1">{actual}/{target || '—'}</div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Accounts</h2>
            <span className="text-xs text-gray-500">{(campaign.accounts || []).length}</span>
          </div>
          <div className="grid gap-3 max-h-[420px] overflow-y-auto pr-1">
            {(campaign.accounts || []).map((account: any) => (
              <div key={account.id} className="flex flex-wrap items-center justify-between gap-4 border border-dashed border-gray-200 rounded-lg px-4 py-3">
                <div>
                  <div className="font-medium">{account.name}</div>
                  <div className="text-xs text-gray-500">{account.tiktokHandle ?? '—'}</div>
                </div>
                <span className="text-[11px] uppercase tracking-wide text-gray-500">{account.accountType}</span>
                <div className="flex flex-1 flex-wrap items-center justify-end gap-2 text-[10px] uppercase tracking-wide text-gray-500">
                  {accountCategoryOrder.map((cat) => {
                    const entry = accountKpiMap.get(account.id)?.[cat];
                    return (
                      <div key={cat} className="flex min-w-[80px] flex-col items-center rounded-lg border border-gray-100 bg-gray-50 px-2 py-1 text-center">
                        <div className="text-[9px] text-gray-500">{categoryLabels[cat]}</div>
                        <div className="text-sm font-semibold text-gray-800">{entry ? `${entry.actual}/${entry.target}` : '— / —'}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <Link to={`/campaigns/${campaign.id}/accounts/${account.id}/edit`} className="btn btn-outline text-xs px-3 py-1">
                    Edit KPIs
                  </Link>
                  <Button variant="ghost" className="text-xs px-3 py-1" onClick={() => handleAccountRemove(account.id)} disabled={accountRemoving[account.id]}>
                    {accountRemoving[account.id] ? 'Removing…' : 'Remove'}
                  </Button>
                </div>
              </div>
            ))}
            {(campaign.accounts || []).length === 0 && <div className="text-sm text-gray-500">No linked accounts.</div>}
          </div>
        </Card>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">Posts overview</h2>
            <p className="text-xs text-gray-500">{posts.length} posts · {totalViews} views · {totalLikes} likes</p>
          </div>
          <Link to={`/campaigns/${campaign.id}/posts`} className="text-indigo-600 text-sm hover:underline">
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
                              <a href={p.contentLink} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: '#2563eb' }}>
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
                          <TD>
                            <button
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
                              className="btn btn-ghost text-xs px-2 py-1"
                              type="button"
                            >
                              Edit
                            </button>
                          </TD>
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
    </div>
  );
}
