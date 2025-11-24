import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
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
import Papa from 'papaparse';

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
  campaignCategory?: string;
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
  accountType?: 'CROSSBRAND' | 'NEW_PERSONA' | 'KOL' | 'PROXY';
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

type CsvRow = Record<string, string>;

const CSV_EXPORT_COLUMNS = [
  { key: 'no', label: 'NO' },
  { key: 'postDay', label: 'Hari Posting' },
  { key: 'postDate', label: 'TANGGAL POSTING' },
  { key: 'picTalent', label: 'PIC Talent' },
  { key: 'picEditor', label: 'PIC Editor' },
  { key: 'picPosting', label: 'PIC Posting' },
  { key: 'accountType', label: 'Tipe Akun' },
  { key: 'contentCategory', label: 'Kategori Konten' },
  { key: 'adsOnMusic', label: 'ADS ON MUSIC' },
  { key: 'yellowCart', label: 'KERANJANG KUNING' },
  { key: 'campaignName', label: 'CAMPAIGN' },
  { key: 'campaignCategory', label: 'CATEGORY' },
  { key: 'accountName', label: 'AKUN POSTING' },
  { key: 'postTitle', label: 'JUDUL' },
  { key: 'contentType', label: 'JENIS' },
  { key: 'status', label: 'STATUS' },
  { key: 'contentLink', label: 'LINK KONTEN' },
  { key: 'totalView', label: 'TOTAL VIEW' },
  { key: 'totalLike', label: 'TOTAL LIKE' },
  { key: 'totalComment', label: 'TOTAL COMMENT' },
  { key: 'totalShare', label: 'TOTAL SHARE' },
  { key: 'totalSaved', label: 'TOTAL SAVED' },
] as const;

const ACCOUNT_TYPES: AccountOption['accountType'][] = ['CROSSBRAND', 'NEW_PERSONA', 'KOL', 'PROXY'];
const CSV_REQUIRED_IMPORT_HEADERS = ['TANGGAL POSTING', 'AKUN POSTING', 'JUDUL', 'JENIS', 'KATEGORI KONTEN', 'STATUS', 'CATEGORY', 'CAMPAIGN'];

const normalizeCsvHeader = (value?: string) => (value ? value.trim().toUpperCase().replace(/\s+/g, ' ') : '');
const getCsvValue = (row: CsvRow, headerMap: Map<string, string>, headerName: string) => {
  const normalized = normalizeCsvHeader(headerName);
  const actualHeader = headerMap.get(normalized);
  const candidate = actualHeader ? row[actualHeader] : undefined;
  return candidate ? candidate.trim() : '';
};
const parseBooleanFlag = (value?: string) => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'yes' || normalized === 'true' || normalized === '1';
};
const parseIntegerField = (value?: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return 0;
  const parsed = parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};
const normalizeAccountType = (value?: string) => {
  if (!value) return '';
  const normalized = value.trim().replace(/[\s-]+/g, '_').toUpperCase();
  return ACCOUNT_TYPES.includes(normalized as AccountOption['accountType']) ? (normalized as AccountOption['accountType']) : '';
};

const findPicIdByName = (value: string | undefined, pics: PicOption[]) => {
  if (!value) return undefined;
  const normalizedValue = value.trim().toLowerCase();
  return pics.find((pic) => pic.name.trim().toLowerCase() === normalizedValue)?.id;
};

// Helper function to remove leading zeros from number input
const sanitizeNumberInput = (value: string): string => {
  if (value === '' || value === '0') return value;
  // Remove leading zeros but keep the number
  const num = value.replace(/^0+/, '');
  return num === '' ? '0' : num;
};

export default function AllPostsPage() {
  const { token } = useAuth();
  const { canAddPost, canEditPost, canDeletePost } = usePermissions();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [pics, setPics] = useState<PicOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<FilterState & { postTitle: string; contentType: string; contentLink: string; contentCategory: string; campaignCategory: string; postDate: string; adsOnMusic: string; yellowCart: string; totalView: string; totalLike: string; totalComment: string; totalShare: string; totalSaved: string }>>({});
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const editCampaignCategoryOptions = useMemo(() => {
    if (!editForm.campaignId) return [];
    const selectedCampaign = campaigns.find((c) => c.id === editForm.campaignId);
    if (!selectedCampaign || !Array.isArray(selectedCampaign.categories)) return [];
    return selectedCampaign.categories.filter((cat) => cat).sort();
  }, [campaigns, editForm.campaignId]);

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
      campaignCategory: post.campaignCategory || '',
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
          campaignCategory: editForm.campaignCategory || undefined,
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

  const handleExportCsv = useCallback(() => {
    const csvRows = posts.map((post, index) => {
      const picTalentName = post.picTalent?.name || (post.picTalentId ? pics.find((pic) => pic.id === post.picTalentId)?.name : '') || '';
      const picEditorName = post.picEditor?.name || (post.picEditorId ? pics.find((pic) => pic.id === post.picEditorId)?.name : '') || '';
      const picPostingName = post.picPosting?.name || (post.picPostingId ? pics.find((pic) => pic.id === post.picPostingId)?.name : '') || '';
      const account = accounts.find((acc) => acc.id === post.accountId);
      const campaign = campaigns.find((c) => c.id === post.campaignId);
      return {
        no: index + 1,
        postDay: post.postDay || '',
        postDate: post.postDate ? new Date(post.postDate).toISOString().split('T')[0] : '',
        picTalent: picTalentName,
        picEditor: picEditorName,
        picPosting: picPostingName,
        accountType: account?.accountType || '',
        contentCategory: post.contentCategory || '',
        adsOnMusic: post.adsOnMusic ? 'Yes' : 'No',
        yellowCart: post.yellowCart ? 'Yes' : 'No',
        campaignName: campaign?.name || '',
        campaignCategory: post.campaignCategory || '',
        accountName: account?.name || '',
        postTitle: post.postTitle || '',
        contentType: post.contentType || '',
        status: post.status || '',
        contentLink: post.contentLink || '',
        totalView: post.totalView ?? 0,
        totalLike: post.totalLike ?? 0,
        totalComment: post.totalComment ?? 0,
        totalShare: post.totalShare ?? 0,
        totalSaved: post.totalSaved ?? 0,
      };
    });

    const csvStringWithKeys = Papa.unparse(csvRows, {
      columns: CSV_EXPORT_COLUMNS.map((column) => column.key),
      header: true,
    });
    // Replace header row with custom labels
    const lines = csvStringWithKeys.split('\n');
    lines[0] = CSV_EXPORT_COLUMNS.map((column) => column.label).join(',');
    const csvString = lines.join('\n');

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all-posts-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [posts, accounts, pics, campaigns]);

  const triggerCsvImport = () => {
    fileInputRef.current?.click();
  };

  const handleCsvFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }
    if (!token) {
      setToast({ type: 'error', text: 'Authentication is required to import posts.' });
      input.value = '';
      return;
    }

    setImportingCsv(true);
    setToast(null);
    try {
      const content = await file.text();
      const parsed = Papa.parse<CsvRow>(content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => (header ? header.trim() : ''),
      });

      if (parsed.errors.length > 0) {
        throw new Error(parsed.errors[0].message || 'Failed to parse CSV file.');
      }

      const fields = parsed.meta.fields;
      if (!fields || fields.length === 0) {
        throw new Error('CSV file is missing headers.');
      }

      const headerMap = new Map<string, string>();
      fields.forEach((field) => {
        if (field) {
          headerMap.set(normalizeCsvHeader(field), field);
        }
      });

      const missingHeaders = CSV_REQUIRED_IMPORT_HEADERS.filter((header) => !headerMap.has(normalizeCsvHeader(header)));
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
      }

      const rows = (parsed.data as CsvRow[]).filter((row) =>
        Object.values(row).some((value) => value && value.trim() !== ''),
      );
      if (rows.length === 0) {
        throw new Error('CSV file does not contain any data rows.');
      }

      const accountLookup = new Map<string, AccountOption>();
      accounts.forEach((account) => {
        if (account.name) {
          accountLookup.set(account.name.trim().toLowerCase(), account);
        }
      });

      const campaignLookup = new Map<string, CampaignOption>();
      campaigns.forEach((campaign) => {
        if (campaign.name) {
          campaignLookup.set(campaign.name.trim().toLowerCase(), campaign);
        }
      });

      let importedCount = 0;

      for (const [index, row] of rows.entries()) {
        const rowNumber = index + 2;
        const accountName = getCsvValue(row, headerMap, 'AKUN POSTING');
        if (!accountName) {
          throw new Error(`Row ${rowNumber}: Missing account name`);
        }

        const campaignNameFromCsv = getCsvValue(row, headerMap, 'CAMPAIGN');
        if (!campaignNameFromCsv) {
          throw new Error(`Row ${rowNumber}: Missing campaign name`);
        }

        // Find campaign by name
        const normalizedCampaignName = campaignNameFromCsv.trim().toLowerCase();
        let campaign = campaignLookup.get(normalizedCampaignName);
        
        if (!campaign) {
          // Try to find in existing campaigns (case-insensitive)
          campaign = campaigns.find((c) => c.name.trim().toLowerCase() === normalizedCampaignName);
          if (campaign) {
            campaignLookup.set(normalizedCampaignName, campaign);
          } else {
            throw new Error(
              `Row ${rowNumber}: Campaign "${campaignNameFromCsv}" not found. Please create the campaign first.`,
            );
          }
        }

        const normalizedAccountName = accountName.trim().toLowerCase();
        let account = accountLookup.get(normalizedAccountName);
        const accountType = normalizeAccountType(getCsvValue(row, headerMap, 'Tipe Akun')) || 'CROSSBRAND';
        if (!account) {
          const created = (await api('/accounts', {
            method: 'POST',
            token,
            body: {
              name: accountName.trim(),
              accountType,
            },
          })) as AccountOption;
          accountLookup.set(created.name.trim().toLowerCase(), created);
          setAccounts((prev) => [...prev, created]);
          account = created;
        }

        const postTitle = getCsvValue(row, headerMap, 'JUDUL');
        if (!postTitle) {
          throw new Error(`Row ${rowNumber}: Missing post title`);
        }

        const contentType = getCsvValue(row, headerMap, 'JENIS');
        if (!contentType) {
          throw new Error(`Row ${rowNumber}: Missing content type`);
        }

        const contentCategory = getCsvValue(row, headerMap, 'KATEGORI KONTEN');
        if (!contentCategory) {
          throw new Error(`Row ${rowNumber}: Missing content category`);
        }

        const status = getCsvValue(row, headerMap, 'STATUS');
        if (!status) {
          throw new Error(`Row ${rowNumber}: Missing status`);
        }

        const postDateValue = getCsvValue(row, headerMap, 'TANGGAL POSTING');
        if (!postDateValue) {
          throw new Error(`Row ${rowNumber}: Missing post date`);
        }

        const parsedDate = new Date(postDateValue);
        if (Number.isNaN(parsedDate.getTime())) {
          throw new Error(`Row ${rowNumber}: Invalid post date (${postDateValue})`);
        }

        const campaignCategoryValue = getCsvValue(row, headerMap, 'CATEGORY');
        if (!campaignCategoryValue) {
          throw new Error(`Row ${rowNumber}: Missing campaign category`);
        }

        // Validate campaign category belongs to the campaign
        if (!campaign.categories.includes(campaignCategoryValue)) {
          throw new Error(
            `Row ${rowNumber}: Campaign category "${campaignCategoryValue}" is not valid for campaign "${campaign.name}". Valid categories: ${campaign.categories.join(', ')}`,
          );
        }

        const payload = {
          campaignId: campaign.id,
          accountId: account.id,
          postDate: parsedDate.toISOString(),
          picTalentId: findPicIdByName(getCsvValue(row, headerMap, 'PIC Talent'), pics),
          picEditorId: findPicIdByName(getCsvValue(row, headerMap, 'PIC Editor'), pics),
          picPostingId: findPicIdByName(getCsvValue(row, headerMap, 'PIC Posting'), pics),
          contentCategory,
          campaignCategory: campaignCategoryValue,
          adsOnMusic: parseBooleanFlag(getCsvValue(row, headerMap, 'ADS ON MUSIC')),
          yellowCart: parseBooleanFlag(getCsvValue(row, headerMap, 'KERANJANG KUNING')),
          postTitle,
          contentType,
          status,
          contentLink: getCsvValue(row, headerMap, 'LINK KONTEN'),
          totalView: parseIntegerField(getCsvValue(row, headerMap, 'TOTAL VIEW')),
          totalLike: parseIntegerField(getCsvValue(row, headerMap, 'TOTAL LIKE')),
          totalComment: parseIntegerField(getCsvValue(row, headerMap, 'TOTAL COMMENT')),
          totalShare: parseIntegerField(getCsvValue(row, headerMap, 'TOTAL SHARE')),
          totalSaved: parseIntegerField(getCsvValue(row, headerMap, 'TOTAL SAVED')),
        };

        await api('/posts', { method: 'POST', token, body: payload });
        importedCount += 1;
      }

      await fetchPosts();
      setToast({ type: 'success', text: `Imported ${importedCount} posts.` });
    } catch (error) {
      setToast({ type: 'error', text: (error as Error).message });
    } finally {
      setImportingCsv(false);
      input.value = '';
    }
  };

  return (
    <div>
      <PageHeader
        backPath="/campaigns"
        backLabel="Back to campaigns"
        title={<h2 className="page-title">All Posts</h2>}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleCsvFileChange}
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
      ) : (
        <Card>
          <div className="card-inner-table">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
              <p className="text-xs text-gray-500">
                Export all posts or import new ones from a CSV. Campaign names in CSV must match existing campaigns.
              </p>
              <div className="flex flex-wrap gap-2">
                <RequirePermission permission={canAddPost}>
                  <Button
                    onClick={triggerCsvImport}
                    variant="outline"
                    disabled={importingCsv}
                  >
                    {importingCsv ? 'Importing CSV...' : 'Import CSV'}
                  </Button>
                </RequirePermission>
                <Button
                  onClick={handleExportCsv}
                  variant="outline"
                  disabled={posts.length === 0}
                >
                  Export CSV
                </Button>
              </div>
            </div>
            {posts.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-500 text-lg">No posts found</p>
                <p className="text-gray-400 text-sm mt-2">
                  {Object.values(filters).some(f => f !== '') 
                    ? 'Try adjusting your filters to see more results.'
                    : 'There are no posts available. Import posts from CSV to get started.'}
                </p>
              </div>
            ) : (
              <TableWrap>
                <Table>
                  <THead>
                    <TR>
                      <TH>NO</TH>
                      <TH className="!text-center">Actions</TH>
                      <TH>Campaign</TH>
                      <TH>Campaign Category</TH>
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
                          <TD>{p.campaignCategory || '—'}</TD>
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
            )}
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
          <div className="grid gap-4 lg:grid-cols-3">
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
            <div>
              <Select
                label="Campaign Category"
                value={editForm.campaignCategory || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, campaignCategory: e.target.value }))}
              >
                <option value="">Select category</option>
                {editCampaignCategoryOptions.map((category) => (
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
                type="number"
                placeholder="0"
                value={editForm.totalView ?? ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, totalView: sanitizeNumberInput(e.target.value) }))}
              />
            </div>
            <div>
              <Input
                label="Likes"
                type="number"
                placeholder="0"
                value={editForm.totalLike ?? ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, totalLike: sanitizeNumberInput(e.target.value) }))}
              />
            </div>
            <div>
              <Input
                label="Comments"
                type="number"
                placeholder="0"
                value={editForm.totalComment ?? ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, totalComment: sanitizeNumberInput(e.target.value) }))}
              />
            </div>
            <div>
              <Input
                label="Shares"
                type="number"
                placeholder="0"
                value={editForm.totalShare ?? ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, totalShare: sanitizeNumberInput(e.target.value) }))}
              />
            </div>
            <div>
              <Input
                label="Saved"
                type="number"
                placeholder="0"
                value={editForm.totalSaved ?? ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, totalSaved: sanitizeNumberInput(e.target.value) }))}
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

