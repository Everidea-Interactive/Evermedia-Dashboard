import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
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
  categories: string[];
};

type PicOption = {
  id: string;
  name: string;
  roles: string[];
};

type AccountOption = {
  id: string;
  name: string;
  accountType: 'BRAND_SPECIFIC' | 'CROSSBRAND';
};

type FormState = {
  campaignId: string;
  campaignCategory: string;
  picContentId: string;
  picEditorId: string;
  picPostingId: string;
  accountName: string;
  accountType: AccountOption['accountType'] | '';
  contentCategory: string;
  contentType: string;
  status: string;
  contentLink: string;
  postTitle: string;
  postDate: string;
  adsOnMusic: 'true' | 'false';
  yellowCart: 'true' | 'false';
};

type FormMessage = {
  type: 'success' | 'error';
  text: string;
};

const CONTENT_CATEGORY_OPTIONS = ['Teaser', 'BTS', 'Product Highlight', 'Tutorial', 'Story', 'Review'];
const CONTENT_TYPE_OPTIONS = ['Video', 'Photo', 'Reel', 'Live', 'Story'];
const STATUS_OPTIONS = ['PLANNED', 'SCHEDULED', 'PUBLISHED', 'COMPLETED', 'CANCELLED'];

export default function PostsPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [pics, setPics] = useState<PicOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<FormMessage | null>(null);
  const [form, setForm] = useState<FormState>({
    campaignId: id ?? '',
    campaignCategory: '',
    picContentId: '',
    picEditorId: '',
    picPostingId: '',
    accountName: '',
    accountType: '',
    contentCategory: '',
    contentType: '',
    status: '',
    contentLink: '',
    postTitle: '',
    postDate: '',
    adsOnMusic: 'false',
    yellowCart: 'false',
  });
  const [showAccountSuggestions, setShowAccountSuggestions] = useState(false);
  const [accountInputFocused, setAccountInputFocused] = useState(false);
  const suggestionBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<FormState>>({});
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const routeCampaignId = id;
  const campaignIdForPosts = routeCampaignId || form.campaignId;
  const showPostTable = Boolean(routeCampaignId);
  const backPath = routeCampaignId ? `/campaigns/${routeCampaignId}` : '/campaigns';
  const backLabel = routeCampaignId ? 'Back to campaign' : 'Back to campaigns';

  const fetchPostsForCampaign = useCallback(
    async (campaignId: string) => {
      const data = await api(`/campaigns/${campaignId}/posts`, { token });
      return data as Post[];
    },
    [token],
  );

  const refreshPosts = useCallback(async () => {
    if (!campaignIdForPosts) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchPostsForCampaign(campaignIdForPosts);
      setPosts(data);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [campaignIdForPosts, fetchPostsForCampaign]);

  useEffect(() => {
    void refreshPosts();
  }, [refreshPosts]);

  useEffect(() => {
    if (!token) return;
    api('/campaigns', { token }).then(setCampaigns).catch(() => {});
    api('/pics?active=true', { token }).then(setPics).catch(() => {});
    api('/accounts', { token }).then(setAccounts).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!routeCampaignId) return;
    setForm((prev) => {
      if (prev.campaignId === routeCampaignId) return prev;
      const selected = campaigns.find((c) => c.id === routeCampaignId);
      const newCategories = Array.isArray(selected?.categories) ? selected.categories : [];
      // If the current category is not in the new campaign's categories, reset it
      const shouldResetCategory = prev.campaignCategory && !newCategories.includes(prev.campaignCategory);
      return {
        ...prev,
        campaignId: routeCampaignId,
        campaignCategory: shouldResetCategory 
          ? (newCategories.length > 0 ? newCategories[0] : '')
          : (newCategories.length > 0 && !prev.campaignCategory ? newCategories[0] : prev.campaignCategory),
      };
    });
  }, [routeCampaignId, campaigns]);

  const talentPics = useMemo(() => pics.filter((pic) => pic.roles.some((role) => role.toUpperCase() === 'TALENT')), [pics]);
  const editorPics = useMemo(() => pics.filter((pic) => pic.roles.some((role) => role.toUpperCase() === 'EDITOR')), [pics]);
  const postingPics = useMemo(() => pics.filter((pic) => pic.roles.some((role) => role.toUpperCase() === 'POSTING')), [pics]);

  const handleCampaignChange = (value: string) => {
    const selected = campaigns.find((c) => c.id === value);
    setForm((prev) => {
      const newCategories = Array.isArray(selected?.categories) ? selected.categories : [];
      // If the current category is not in the new campaign's categories, reset it
      const shouldResetCategory = prev.campaignCategory && !newCategories.includes(prev.campaignCategory);
      return {
        ...prev,
        campaignId: value,
        campaignCategory: shouldResetCategory 
          ? (newCategories.length > 0 ? newCategories[0] : '')
          : prev.campaignCategory,
      };
    });
    setToast(null);
    if (value && id && value !== id) {
      navigate(`/campaigns/${value}/posts`);
    }
  };

  const handleFormChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setToast(null);
    if (field === 'accountName') {
      setAccountInputFocused(true);
    }
  };

  const matchingAccount = useMemo(() => {
    const candidate = form.accountName.trim();
    if (!candidate) return undefined;
    return accounts.find((a) => a.name.toLowerCase() === candidate.toLowerCase());
  }, [form.accountName, accounts]);

  const filteredAccounts = useMemo(() => {
    const query = form.accountName.trim().toLowerCase();
    if (!query) return [];
    return accounts
      .filter((account) => account.name.toLowerCase().includes(query))
      .slice(0, 6);
  }, [accounts, form.accountName]);

  useEffect(() => {
    if (!matchingAccount) return;
    if (matchingAccount.accountType === form.accountType) return;
    setForm((prev) => ({ ...prev, accountType: matchingAccount.accountType }));
  }, [matchingAccount, form.accountType]);

  const handleAccountFocus = () => {
    setAccountInputFocused(true);
    if (filteredAccounts.length) {
      setShowAccountSuggestions(true);
    }
  };

  const handleAccountBlur = () => {
    if (suggestionBlurTimer.current) clearTimeout(suggestionBlurTimer.current);
    suggestionBlurTimer.current = setTimeout(() => setShowAccountSuggestions(false), 100);
    setAccountInputFocused(false);
  };

  useEffect(() => {
    if (!form.accountName) {
      setShowAccountSuggestions(false);
      return;
    }
    if (filteredAccounts.length > 0) {
      setShowAccountSuggestions(true);
    }
  }, [filteredAccounts, form.accountName]);

  const handleAccountSelection = (account: AccountOption) => {
    setForm((prev) => ({ ...prev, accountName: account.name, accountType: account.accountType }));
    setShowAccountSuggestions(false);
    setAccountInputFocused(false);
  };

  const campaignCategoryOptions = useMemo(() => {
    if (!form.campaignId) return [];
    const selectedCampaign = campaigns.find((c) => c.id === form.campaignId);
    if (!selectedCampaign || !Array.isArray(selectedCampaign.categories)) return [];
    return selectedCampaign.categories.filter((cat) => cat).sort();
  }, [campaigns, form.campaignId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.campaignId || !form.accountName.trim() || !form.postDate || !form.postTitle.trim()) {
      setToast({ type: 'error', text: 'Campaign, account name, post date, and title are required.' });
      return;
    }
    setSubmitting(true);
    setToast(null);
    try {
      let accountToUse = matchingAccount;
      let createdAccount = false;
      if (!accountToUse) {
        const accountPayload = {
          name: form.accountName,
          accountType: form.accountType || 'BRAND_SPECIFIC',
        };
        const created = await api('/accounts', { method: 'POST', token, body: accountPayload }) as AccountOption;
        accountToUse = created;
        createdAccount = true;
        setAccounts((prev) => [...prev, created]);
        setForm((prev) => ({ ...prev, accountType: created.accountType ?? prev.accountType }));
      }
      await api('/posts', {
        method: 'POST',
        token,
        body: {
          campaignId: form.campaignId,
          accountId: accountToUse!.id,
          postDate: form.postDate,
          picTalentId: form.picContentId || undefined,
          picEditorId: form.picEditorId || undefined,
          picPostingId: form.picPostingId || undefined,
          contentCategory: form.contentCategory || undefined,
          adsOnMusic: form.adsOnMusic === 'true',
          yellowCart: form.yellowCart === 'true',
          postTitle: form.postTitle,
          contentType: form.contentType || undefined,
          status: form.status || undefined,
          contentLink: form.contentLink || undefined,
        },
      });
      setToast({
        type: 'success',
        text: createdAccount ? 'Post recorded and account created.' : 'Post recorded. Refreshing list.',
      });
      setForm((prev) => ({
        ...prev,
        picContentId: '',
        picEditorId: '',
        picPostingId: '',
        accountName: '',
        accountType: '',
        contentCategory: '',
        postTitle: '',
        contentType: '',
        status: '',
        contentLink: '',
        postDate: '',
        adsOnMusic: 'false',
        yellowCart: 'false',
      }));
      await refreshPosts();
    } catch (error) {
      setToast({ type: 'error', text: (error as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4_000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!accountInputFocused) {
      setShowAccountSuggestions(false);
      return;
    }
    if (!form.accountName.trim()) {
      setShowAccountSuggestions(false);
      return;
    }
    setShowAccountSuggestions(filteredAccounts.length > 0);
  }, [accountInputFocused, filteredAccounts.length, form.accountName]);

  useEffect(() => {
    return () => {
      if (suggestionBlurTimer.current) clearTimeout(suggestionBlurTimer.current);
    };
  }, []);

  const handleEditPost = (post: Post) => {
    setEditingPostId(post.id);
    setEditForm({
      campaignId: post.campaignId,
      campaignCategory: '',
      picContentId: post.picTalentId || '',
      picEditorId: post.picEditorId || '',
      picPostingId: post.picPostingId || '',
      accountName: post.account?.name || '',
      accountType: '',
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

  const handleUpdatePost = async (e: FormEvent) => {
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
          picTalentId: editForm.picContentId || undefined,
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
      
      // Update the post in the list without reloading, preserving account/campaign/PIC objects
      setPosts(prevPosts => prevPosts.map(p => {
        if (p.id === editingPostId) {
          // Helper to get PIC object or null
          const getPicObject = (picId: string | undefined) => {
            if (!picId) return null;
            const pic = pics.find(p => p.id === picId);
            return pic ? { id: pic.id, name: pic.name } : null;
          };
          
          // Preserve account, campaign, and update PIC objects from form
          return {
            ...updatedPost,
            account: post.account,
            campaign: post.campaign,
            picTalent: getPicObject(editForm.picContentId),
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

  return (
    <div>
      <PageHeader
        backPath={backPath}
        backLabel={backLabel}
        title={<h2 className="page-title">Posts</h2>}
      />

      <Card className="space-y-4 mb-6">
        <div className="flex flex-col gap-1">
          <div className="text-lg font-semibold">Log a new post</div>
          <p className="text-xs text-gray-500">Use the form below to capture post metadata before publishing.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <Select
                label="Campaign"
                value={form.campaignId}
                onChange={(event) => handleCampaignChange(event.target.value)}
              >
                <option value="">Select campaign</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Select
                label="Campaign Category"
                value={form.campaignCategory}
                onChange={(event) => handleFormChange('campaignCategory', event.target.value)}
              >
                <option value="">Select category</option>
                {campaignCategoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Select
                label="PIC Content"
                value={form.picContentId}
                onChange={(event) => handleFormChange('picContentId', event.target.value)}
              >
                <option value="">Select PIC</option>
                {talentPics.map((pic) => (
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
                label="PIC Editor"
                value={form.picEditorId}
                onChange={(event) => handleFormChange('picEditorId', event.target.value)}
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
                value={form.picPostingId}
                onChange={(event) => handleFormChange('picPostingId', event.target.value)}
              >
                <option value="">Select Posting</option>
                {postingPics.map((pic) => (
                  <option key={pic.id} value={pic.id}>
                    {pic.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Select
                label="Account Type"
                value={form.accountType}
                onChange={(event) => handleFormChange('accountType', event.target.value)}
              >
                <option value="">Select type (auto detects match)</option>
                <option value="BRAND_SPECIFIC">BRAND_SPECIFIC</option>
                <option value="CROSSBRAND">CROSSBRAND</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <Select
                label="Content Type"
                value={form.contentType}
                onChange={(event) => handleFormChange('contentType', event.target.value)}
              >
                <option value="">Select type</option>
                {CONTENT_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Select
                label="Status"
                value={form.status}
                onChange={(event) => handleFormChange('status', event.target.value)}
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
                label="Content Category"
                value={form.contentCategory}
                onChange={(event) => handleFormChange('contentCategory', event.target.value)}
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
                label="Ads On Music"
                value={form.adsOnMusic}
                onChange={(event) => handleFormChange('adsOnMusic', event.target.value)}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </Select>
            </div>
            <div>
              <Select
                label="Yellow Cart"
                value={form.yellowCart}
                onChange={(event) => handleFormChange('yellowCart', event.target.value)}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </Select>
            </div>
            <div>
              <Input
                label="Post Date"
                type="date"
                value={form.postDate}
                onChange={(event) => handleFormChange('postDate', event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-1 relative">
              <Input
                label="Account Name"
                placeholder="Exact account name"
                value={form.accountName}
                onChange={(event) => handleFormChange('accountName', event.target.value)}
                onFocus={handleAccountFocus}
                onBlur={handleAccountBlur}
              />
              {showAccountSuggestions && filteredAccounts.length > 0 && (
                <div className="absolute inset-x-0 top-full mt-2 z-30">
                  <div className="max-h-44 overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-2xl shadow-indigo-200/80">
                    {filteredAccounts.map((account, index) => (
                      <button
                        type="button"
                        key={account.id}
                        className={`w-full text-left px-4 py-3 text-sm transition-colors duration-150 ${
                          index === filteredAccounts.length - 1 ? '' : 'border-b border-gray-100 hover:bg-indigo-50'
                        }`}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          handleAccountSelection(account);
                          setShowAccountSuggestions(false);
                        }}
                      >
                        <div className="font-semibold text-gray-900">{account.name}</div>
                        <div className="text-xs text-indigo-500">{account.accountType}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {form.accountName ? (
                matchingAccount ? (
                  <p className="text-xs text-green-600">Linked to {matchingAccount.name} ({matchingAccount.accountType}).</p>
                ) : (
                  <p className="text-xs text-indigo-600">No existing account matches the name; we will create one after saving.</p>
                )
              ) : (
                <p className="text-xs text-gray-500">Typing the exact name will bind the existing account.</p>
              )}
            </div>
            <div className="space-y-1">
              <Input
                label="Post Title"
                placeholder="Enter title"
                value={form.postTitle}
                onChange={(event) => handleFormChange('postTitle', event.target.value)}
              />
            </div>
            <div>
              <Input
                label="Content Link"
                placeholder="https://..."
                value={form.contentLink}
                onChange={(event) => handleFormChange('contentLink', event.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save post'}
            </Button>
          </div>
        </form>
      </Card>

      {showPostTable && (
        loading ? (
          <div className="skeleton h-10 w-full" />
        ) : (
          <Card>
            <div className="card-inner-table">
              <TableWrap>
                  <Table>
                    <THead>
                      <TR>
                        <TH>NO</TH>
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
                        <TH>Actions</TH>
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
                            <TD>{campaignName}</TD>
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
                            <TD>
                              <button
                                onClick={() => handleEditPost(p)}
                                className="btn btn-ghost text-xs px-2 py-1"
                                type="button"
                              >
                                Edit
                              </button>
                            </TD>
                          </TR>
                        );
                      })}
                    </tbody>
                  </Table>
                </TableWrap>
            </div>
          </Card>
        )
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
            <Button onClick={handleUpdatePost} disabled={submittingEdit}>
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
                {CONTENT_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
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
                value={editForm.picContentId || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, picContentId: e.target.value }))}
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
