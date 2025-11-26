import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { api } from '../lib/api';
import { scrapeTikTokUrlsBatchWithOriginals, isTikTokUrl } from '../lib/tiktokScraper';
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
  accountType: 'CROSSBRAND' | 'NEW_PERSONA' | 'KOL' | 'PROXY';
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
  totalView: string;
  totalLike: string;
  totalComment: string;
  totalShare: string;
  totalSaved: string;
};

type FormMessage = {
  type: 'success' | 'error';
  text: string;
};

const CONTENT_CATEGORY_OPTIONS = ['Hardsell product', 'Trend/FOMO', 'Berita/Event', 'Topik Sensitive', 'Sosok/Quotes/Film', 'Storytell', 'Edukasi Product'];
const CONTENT_TYPE_OPTIONS = ['Slide', 'Video'];
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
const CSV_REQUIRED_IMPORT_HEADERS = ['TANGGAL POSTING', 'AKUN POSTING', 'JUDUL', 'JENIS', 'KATEGORI KONTEN', 'STATUS', 'CATEGORY'];

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

export default function PostsPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { canAddPost, canDeletePost, canManageCampaigns } = usePermissions();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [pics, setPics] = useState<PicOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<FormMessage | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [updatingEngagement, setUpdatingEngagement] = useState(false);
  const [engagementUpdateProgress, setEngagementUpdateProgress] = useState<{ current: number; total: number } | null>(null);
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
    totalView: '',
    totalLike: '',
    totalComment: '',
    totalShare: '',
    totalSaved: '',
  });
  const [showAccountSuggestions, setShowAccountSuggestions] = useState(false);
  const [accountInputFocused, setAccountInputFocused] = useState(false);
  const suggestionBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingCell, setEditingCell] = useState<{ postId: string; field: string } | null>(null);
  const [cellEditValue, setCellEditValue] = useState<string>('');
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectChangeInProgressRef = useRef<string | null>(null);
  const initialCellValueRef = useRef<string>('');

  const routeCampaignId = id;
  const campaignIdForPosts = routeCampaignId || form.campaignId;
  const showPostTable = Boolean(routeCampaignId);
  const backPath = routeCampaignId ? `/campaigns/${routeCampaignId}` : '/campaigns';
  const backLabel = routeCampaignId ? 'Back to campaign' : 'Back to campaigns';

  const fetchPostsForCampaign = useCallback(
    async (campaignId: string) => {
      const response = await api(`/campaigns/${campaignId}/posts`, { token });
      // API returns { posts: [...], total: ... } format
      if (response && typeof response === 'object' && 'posts' in response) {
        return (response.posts as Post[]) || [];
      }
      // Fallback for old API format (direct array)
      return Array.isArray(response) ? response : [];
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

  const handleExportCsv = useCallback(() => {
    if (!campaignIdForPosts) return;
    const campaign = campaigns.find((c) => c.id === campaignIdForPosts);
    const csvRows = posts.map((post, index) => {
      const picTalentName = post.picTalent?.name || (post.picTalentId ? pics.find((pic) => pic.id === post.picTalentId)?.name : '') || '';
      const picEditorName = post.picEditor?.name || (post.picEditorId ? pics.find((pic) => pic.id === post.picEditorId)?.name : '') || '';
      const picPostingName = post.picPosting?.name || (post.picPostingId ? pics.find((pic) => pic.id === post.picPostingId)?.name : '') || '';
      const account = accounts.find((acc) => acc.id === post.accountId);
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
        campaignCategory: post.campaignCategory || post.contentCategory || '',
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
    const filenameBase = (campaign?.name || 'posts')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'posts';
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filenameBase}-posts.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [campaignIdForPosts, campaigns, posts, accounts, pics]);

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
    if (!campaignIdForPosts) {
      setToast({ type: 'error', text: 'Select a campaign before importing posts.' });
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

      const currentCampaign = campaigns.find((c) => c.id === campaignIdForPosts);
      const normalizedCampaignName = currentCampaign?.name?.trim().toLowerCase() || '';
      let importedCount = 0;

      for (const [index, row] of rows.entries()) {
        const rowNumber = index + 2;
        const accountName = getCsvValue(row, headerMap, 'AKUN POSTING');
        if (!accountName) {
          throw new Error(`Row ${rowNumber}: Missing account name`);
        }

        const campaignNameFromCsv = getCsvValue(row, headerMap, 'CAMPAIGN');
        if (
          campaignNameFromCsv &&
          normalizedCampaignName &&
          campaignNameFromCsv.trim().toLowerCase() !== normalizedCampaignName
        ) {
          throw new Error(
            `Row ${rowNumber}: Campaign (${campaignNameFromCsv}) does not match current campaign (${currentCampaign?.name}).`,
          );
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

        const payload = {
          campaignId: campaignIdForPosts,
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

      await refreshPosts();
      setToast({ type: 'success', text: `Imported ${importedCount} posts.` });
    } catch (error) {
      setToast({ type: 'error', text: (error as Error).message });
    } finally {
      setImportingCsv(false);
      input.value = '';
    }
  };

  const handleFormChange = (field: keyof FormState, value: string) => {
    // Sanitize engagement stats fields to remove leading zeros
    const engagementFields: (keyof FormState)[] = ['totalView', 'totalLike', 'totalComment', 'totalShare', 'totalSaved'];
    const sanitizedValue = engagementFields.includes(field) ? sanitizeNumberInput(value) : value;
    setForm((prev) => ({ ...prev, [field]: sanitizedValue }));
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
    if (!form.campaignId || !form.campaignCategory || !form.picContentId || !form.picEditorId || 
        !form.picPostingId || !form.accountType || !form.contentType || !form.status || 
        !form.contentCategory || !form.accountName.trim() || !form.postDate || !form.postTitle.trim() || 
        !form.contentLink.trim()) {
      setToast({ type: 'error', text: 'Please fill in all required fields.' });
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
          accountType: form.accountType || 'CROSSBRAND',
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
            campaignCategory: form.campaignCategory || undefined,
            adsOnMusic: form.adsOnMusic === 'true',
          yellowCart: form.yellowCart === 'true',
          postTitle: form.postTitle,
          contentType: form.contentType || undefined,
          status: form.status || undefined,
          contentLink: form.contentLink || undefined,
          totalView: parseInt(form.totalView || '0', 10) || 0,
          totalLike: parseInt(form.totalLike || '0', 10) || 0,
          totalComment: parseInt(form.totalComment || '0', 10) || 0,
          totalShare: parseInt(form.totalShare || '0', 10) || 0,
          totalSaved: parseInt(form.totalSaved || '0', 10) || 0,
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
        campaignCategory: '',
        contentCategory: '',
        postTitle: '',
        contentType: '',
        status: '',
        contentLink: '',
        postDate: '',
        adsOnMusic: 'false',
        yellowCart: 'false',
        totalView: '',
        totalLike: '',
        totalComment: '',
        totalShare: '',
        totalSaved: '',
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

  const handleCellClick = (postId: string, field: string, currentValue: string | number | boolean) => {
    let valueToEdit = '';
    if (typeof currentValue === 'boolean') {
      valueToEdit = currentValue ? 'true' : 'false';
    } else if (field === 'postDate' && currentValue) {
      // Format date as YYYY-MM-DD for date input
      valueToEdit = new Date(currentValue).toISOString().split('T')[0];
    } else if (currentValue !== null && currentValue !== undefined) {
      valueToEdit = String(currentValue);
    }
    setEditingCell({ postId, field });
    setCellEditValue(valueToEdit);
    initialCellValueRef.current = valueToEdit;
  };

  const handleCellBlur = async (postId: string, field: string, skipClose?: boolean, overrideValue?: string): Promise<Post | null> => {
    if (!editingCell || editingCell.postId !== postId || editingCell.field !== field) return null;
    
    const post = posts.find(p => p.id === postId);
    if (!post) return null;

    // Use override value if provided (for immediate saves from onChange), otherwise use state
    const valueToUse = overrideValue !== undefined ? overrideValue : cellEditValue;

    // Check if value actually changed
    let hasChanged = false;
    let newValue: any = valueToUse;

    if (field === 'postDate') {
      const currentDate = post.postDate ? new Date(post.postDate).toISOString().split('T')[0] : '';
      hasChanged = valueToUse !== currentDate;
      if (!hasChanged) {
        if (!skipClose) setEditingCell(null);
        return null;
      }
    } else if (field === 'campaignId') {
      hasChanged = valueToUse !== post.campaignId;
    } else if (field === 'accountId') {
      hasChanged = valueToUse !== post.accountId;
    } else if (field === 'postTitle' || field === 'contentLink') {
      hasChanged = valueToUse !== (post[field] || '');
    } else if (field === 'contentType' || field === 'contentCategory' || field === 'status' || field === 'campaignCategory') {
      hasChanged = valueToUse !== (post[field] || '');
    } else if (field === 'picTalentId' || field === 'picEditorId' || field === 'picPostingId') {
      const currentId = post[field] || '';
      hasChanged = valueToUse !== currentId;
    } else if (field === 'adsOnMusic' || field === 'yellowCart') {
      const currentBool = post[field] ? 'true' : 'false';
      hasChanged = valueToUse !== currentBool;
      newValue = valueToUse === 'true';
    } else if (['totalView', 'totalLike', 'totalComment', 'totalShare', 'totalSaved'].includes(field)) {
      const currentNum = post[field as keyof Post] as number;
      const newNum = parseInt(valueToUse || '0', 10) || 0;
      hasChanged = newNum !== currentNum;
      newValue = newNum;
    }

    if (!hasChanged) {
      if (!skipClose) setEditingCell(null);
      return null;
    }

    setSavingCell(`${postId}-${field}`);
    try {
      const updatePayload: any = {};
      
      if (field === 'postDate') {
        updatePayload.postDate = new Date(valueToUse).toISOString();
      } else if (field === 'campaignId') {
        updatePayload.campaignId = valueToUse || undefined;
      } else if (field === 'accountId') {
        updatePayload.accountId = valueToUse || undefined;
      } else if (field === 'postTitle') {
        updatePayload.postTitle = valueToUse;
      } else if (field === 'contentLink') {
        updatePayload.contentLink = valueToUse;
      } else if (field === 'contentType') {
        updatePayload.contentType = valueToUse;
      } else if (field === 'contentCategory') {
        updatePayload.contentCategory = valueToUse;
      } else if (field === 'campaignCategory') {
        updatePayload.campaignCategory = valueToUse;
      } else if (field === 'status') {
        updatePayload.status = valueToUse;
      } else if (field === 'picTalentId') {
        updatePayload.picTalentId = valueToUse || undefined;
      } else if (field === 'picEditorId') {
        updatePayload.picEditorId = valueToUse || undefined;
      } else if (field === 'picPostingId') {
        updatePayload.picPostingId = valueToUse || undefined;
      } else if (field === 'adsOnMusic') {
        updatePayload.adsOnMusic = newValue;
      } else if (field === 'yellowCart') {
        updatePayload.yellowCart = newValue;
      } else if (['totalView', 'totalLike', 'totalComment', 'totalShare', 'totalSaved'].includes(field)) {
        updatePayload[field] = newValue;
      }

      const updatedPost = await api(`/posts/${postId}`, {
        method: 'PUT',
        token,
        body: updatePayload,
      }) as Post;

      // Helper functions to get related objects
      const getPicObject = (picId: string | undefined) => {
        if (!picId) return null;
        const pic = pics.find(p => p.id === picId);
        return pic ? { id: pic.id, name: pic.name } : null;
      };
      
      const getAccountObject = (accountId: string | undefined) => {
        if (!accountId) return null;
        const account = accounts.find(a => a.id === accountId);
        return account ? { id: account.id, name: account.name } : null;
      };
      
      const getCampaignObject = (campaignId: string | undefined) => {
        if (!campaignId) return null;
        const campaign = campaigns.find(c => c.id === campaignId);
        return campaign ? { id: campaign.id, name: campaign.name } : null;
      };
      
      // Build updated post with relations
      const updatedPostWithRelations: Post = {
        ...updatedPost,
        account: updatedPost.accountId ? getAccountObject(updatedPost.accountId) : post.account,
        campaign: updatedPost.campaignId ? getCampaignObject(updatedPost.campaignId) : post.campaign,
        picTalent: updatedPost.picTalentId ? getPicObject(updatedPost.picTalentId) : post.picTalent,
        picEditor: updatedPost.picEditorId ? getPicObject(updatedPost.picEditorId) : post.picEditor,
        picPosting: updatedPost.picPostingId ? getPicObject(updatedPost.picPostingId) : post.picPosting,
        postDay: updatedPost.postDate ? new Date(updatedPost.postDate).toLocaleDateString('en-US', { weekday: 'long' }) : post.postDay,
      };

      // Update the post in the list
      setPosts(prevPosts => prevPosts.map(p => {
        if (p.id === postId) {
          return updatedPostWithRelations;
        }
        return p;
      }));

      setToast({ type: 'success', text: 'Post updated successfully' });
      return updatedPostWithRelations;
    } catch (error) {
      setToast({ type: 'error', text: (error as Error).message });
      return null;
    } finally {
      setSavingCell(null);
      if (!skipClose) {
        setEditingCell(null);
      }
    }
  };

  // Define the order of editable columns
  const EDITABLE_FIELDS = [
    'campaignId',
    'campaignCategory',
    'accountId',
    'postDate',
    'postTitle',
    'contentType',
    'contentCategory',
    'status',
    'picTalentId',
    'picEditorId',
    'picPostingId',
    'contentLink',
    'adsOnMusic',
    'yellowCart',
    'totalView',
    'totalLike',
    'totalComment',
    'totalShare',
    'totalSaved',
  ] as const;

  const findNextEditableCell = (currentPostIndex: number, currentField: string, direction: 'next' | 'prev'): { postIndex: number; field: string } | null => {
    const currentFieldIndex = EDITABLE_FIELDS.indexOf(currentField as typeof EDITABLE_FIELDS[number]);
    
    if (direction === 'next') {
      // Try next field in same row
      if (currentFieldIndex < EDITABLE_FIELDS.length - 1) {
        return { postIndex: currentPostIndex, field: EDITABLE_FIELDS[currentFieldIndex + 1] };
      }
      // Move to first field of next row
      if (currentPostIndex < posts.length - 1) {
        return { postIndex: currentPostIndex + 1, field: EDITABLE_FIELDS[0] };
      }
    } else {
      // Try previous field in same row
      if (currentFieldIndex > 0) {
        return { postIndex: currentPostIndex, field: EDITABLE_FIELDS[currentFieldIndex - 1] };
      }
      // Move to last field of previous row
      if (currentPostIndex > 0) {
        return { postIndex: currentPostIndex - 1, field: EDITABLE_FIELDS[EDITABLE_FIELDS.length - 1] };
      }
    }
    
    return null;
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, postId: string, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleCellBlur(postId, field);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      
      // Save current cell in background (don't wait for it)
      void handleCellBlur(postId, field, true);
      
      // Navigate immediately using current data
      const currentPostIndex = posts.findIndex(p => p.id === postId);
      
      if (currentPostIndex === -1) {
        setEditingCell(null);
        return;
      }
      
      // Optimistically update the current post with the edited value for navigation
      const post = posts.find(p => p.id === postId);
      if (!post) {
        setEditingCell(null);
        return;
      }
      
      // Create optimistic update for navigation
      const optimisticPost: Post = { ...post };
      if (field === 'postDate') {
        optimisticPost.postDate = new Date(cellEditValue).toISOString();
      } else if (field === 'campaignId') {
        optimisticPost.campaignId = cellEditValue || post.campaignId;
      } else if (field === 'accountId') {
        optimisticPost.accountId = cellEditValue || post.accountId;
      } else if (field === 'postTitle' || field === 'contentLink') {
        (optimisticPost as any)[field] = cellEditValue;
      } else if (field === 'contentType' || field === 'contentCategory' || field === 'status' || field === 'campaignCategory') {
        (optimisticPost as any)[field] = cellEditValue;
      } else if (field === 'picTalentId' || field === 'picEditorId' || field === 'picPostingId') {
        (optimisticPost as any)[field] = cellEditValue || undefined;
      } else if (field === 'adsOnMusic' || field === 'yellowCart') {
        (optimisticPost as any)[field] = cellEditValue === 'true';
      } else if (['totalView', 'totalLike', 'totalComment', 'totalShare', 'totalSaved'].includes(field)) {
        (optimisticPost as any)[field] = parseInt(cellEditValue || '0', 10) || 0;
      }
      
      const optimisticPosts = posts.map(p => p.id === postId ? optimisticPost : p);
      
      const direction = e.shiftKey ? 'prev' : 'next';
      const nextCell = findNextEditableCell(currentPostIndex, field, direction);
      
      if (nextCell) {
        const nextPost = optimisticPosts[nextCell.postIndex];
        if (nextPost) {
          // Get the current value for the next field
          let currentValue: string | number | boolean = '';
          
          if (nextCell.field === 'accountId') {
            currentValue = nextPost.accountId || '';
          } else if (nextCell.field === 'campaignId') {
            currentValue = nextPost.campaignId || '';
          } else if (nextCell.field === 'picTalentId') {
            currentValue = nextPost.picTalentId || '';
          } else if (nextCell.field === 'picEditorId') {
            currentValue = nextPost.picEditorId || '';
          } else if (nextCell.field === 'picPostingId') {
            currentValue = nextPost.picPostingId || '';
          } else if (nextCell.field === 'postDate') {
            currentValue = nextPost.postDate ? new Date(nextPost.postDate).toISOString().split('T')[0] : '';
          } else if (nextCell.field === 'adsOnMusic' || nextCell.field === 'yellowCart') {
            currentValue = nextPost[nextCell.field];
          } else {
            const fieldValue = nextPost[nextCell.field as keyof Post];
            if (typeof fieldValue === 'boolean') {
              currentValue = fieldValue;
            } else if (typeof fieldValue === 'string' || typeof fieldValue === 'number') {
              currentValue = fieldValue;
            }
          }
          
          // Navigate immediately
          handleCellClick(nextPost.id, nextCell.field, currentValue);
        }
      } else {
        // No next cell, close editing
        setEditingCell(null);
      }
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
      await refreshPosts();
      setToast({ type: 'success', text: 'Post deleted successfully' });
    } catch (error) {
      setToast({ type: 'error', text: (error as Error).message });
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const handleUpdateEngagementStats = async () => {
    if (!campaignIdForPosts) return;
    
    setUpdatingEngagement(true);
    setEngagementUpdateProgress(null);
    
    try {
      // Fetch all posts for the campaign
      const allPosts = await fetchPostsForCampaign(campaignIdForPosts);
      
      // Filter posts with TikTok URLs
      const postsWithTikTokUrls = allPosts.filter((post: Post) => 
        post.contentLink && isTikTokUrl(post.contentLink)
      );
      
      if (postsWithTikTokUrls.length === 0) {
        setToast({ 
          type: 'error',
          text: 'No posts with TikTok URLs found in this campaign'
        });
        setUpdatingEngagement(false);
        return;
      }
      
      setEngagementUpdateProgress({ current: 0, total: postsWithTikTokUrls.length });
      
      // Extract URLs
      const urls = postsWithTikTokUrls.map((post: Post) => post.contentLink!);
      
      // Scrape engagement data with original URL tracking
      const scrapeResult = await scrapeTikTokUrlsBatchWithOriginals(urls, 3, 1000);
      
      // Create a map of original URL to engagement data
      const engagementMap = new Map<string, any>();
      scrapeResult.results.forEach((result) => {
        // Map by original URL (which matches post.contentLink)
        engagementMap.set(result.originalUrl, result.data);
        // Also map by resolved URL in case we need it
        if (result.resolvedUrl !== result.originalUrl) {
          engagementMap.set(result.resolvedUrl, result.data);
        }
      });
      
      // Map errors by URL for debugging
      const errorMap = new Map<string, string>();
      scrapeResult.errors.forEach((error) => {
        errorMap.set(error.url, error.error);
      });
      
      // Update each post
      let updatedCount = 0;
      let failedCount = 0;
      
      for (let i = 0; i < postsWithTikTokUrls.length; i++) {
        const post = postsWithTikTokUrls[i];
        const engagementData = engagementMap.get(post.contentLink!);
        
        setEngagementUpdateProgress({ current: i + 1, total: postsWithTikTokUrls.length });
        
        if (engagementData) {
          try {
            await api(`/posts/${post.id}`, {
              method: 'PUT',
              token,
              body: {
                totalView: engagementData.views,
                totalLike: engagementData.likes,
                totalComment: engagementData.comments,
                totalShare: engagementData.shares,
                totalSaved: engagementData.bookmarks,
              },
            });
            updatedCount++;
          } catch (error: any) {
            console.error(`Failed to update post ${post.id}:`, error);
            failedCount++;
          }
        } else {
          const errorMsg = errorMap.get(post.contentLink!);
          if (errorMsg) {
            console.warn(`Failed to scrape ${post.contentLink}: ${errorMsg}`);
          }
          failedCount++;
        }
      }
      
      // Refresh posts
      await refreshPosts();
      
      // Show success message with details
      const successMessage = `Updated ${updatedCount} post${updatedCount !== 1 ? 's' : ''}`;
      const errorMessage = failedCount > 0 ? ` (${failedCount} failed)` : '';
      setToast({ 
        type: failedCount > 0 ? 'error' : 'success',
        text: `${successMessage}${errorMessage}`
      });
    } catch (error: any) {
      console.error('Failed to update engagement stats:', error);
      setToast({ 
        type: 'error',
        text: error?.message || 'Failed to update engagement stats. Please try again.'
      });
    } finally {
      setUpdatingEngagement(false);
      setEngagementUpdateProgress(null);
    }
  };

  return (
    <div>
      <PageHeader
        backPath={backPath}
        backLabel={backLabel}
        title={<h2 className="page-title">Posts</h2>}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleCsvFileChange}
      />

      <RequirePermission permission={canAddPost}>
        <Card className="space-y-4 mb-6">
          <div className="flex flex-col gap-1">
            <div className="text-lg font-semibold">Log a new post</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Use the form below to capture post metadata before publishing.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <Select
                label="Campaign"
                value={form.campaignId}
                onChange={(event) => handleCampaignChange(event.target.value)}
                required
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
                required
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
                required
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
                required
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
                required
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
                required
              >
                <option value="">Select type (auto detects match)</option>
                <option value="CROSSBRAND">CROSSBRAND</option>
                <option value="NEW_PERSONA">New Persona</option>
                <option value="KOL">KOL</option>
                <option value="PROXY">Proxy</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <Select
                label="Content Type"
                value={form.contentType}
                onChange={(event) => handleFormChange('contentType', event.target.value)}
                required
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
                required
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
                required
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
                required
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
                required
              />
              {showAccountSuggestions && filteredAccounts.length > 0 && (
                <div className="absolute inset-x-0 top-full mt-2 z-30">
                  <div className="max-h-44 overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-2xl shadow-indigo-200/80">
                    {filteredAccounts.map((account, index) => (
                      <button
                        type="button"
                        key={account.id}
                        className={`w-full text-left px-4 py-3 text-sm transition-colors duration-150 ${
                          index === filteredAccounts.length - 1 ? '' : 'border-b border-gray-100 dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                        }`}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          handleAccountSelection(account);
                          setShowAccountSuggestions(false);
                        }}
                      >
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{account.name}</div>
                        <div className="text-xs text-indigo-500 dark:text-indigo-400">{account.accountType}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {form.accountName ? (
                matchingAccount ? (
                  <p className="text-xs text-green-600 dark:text-green-400">Linked to {matchingAccount.name} ({matchingAccount.accountType}).</p>
                ) : (
                  <p className="text-xs text-indigo-600 dark:text-indigo-400">No existing account matches the name; we will create one after saving.</p>
                )
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">Typing the exact name will bind the existing account.</p>
              )}
            </div>
            <div className="space-y-1">
              <Input
                label="Post Title"
                placeholder="Enter title"
                value={form.postTitle}
                onChange={(event) => handleFormChange('postTitle', event.target.value)}
                required
              />
            </div>
            <div>
              <Input
                label="Content Link"
                placeholder="https://..."
                value={form.contentLink}
                onChange={(event) => handleFormChange('contentLink', event.target.value)}
                required
              />
            </div>
          </div>
          <div className="border-t pt-4 mt-4">
            <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Engagement Metrics (Optional)</div>
            <div className="grid gap-4 lg:grid-cols-5">
              <div>
                <Input
                  label="Views"
                  type="number"
                  placeholder="0"
                  value={form.totalView}
                  onChange={(event) => handleFormChange('totalView', event.target.value)}
                />
              </div>
              <div>
                <Input
                  label="Likes"
                  type="number"
                  placeholder="0"
                  value={form.totalLike}
                  onChange={(event) => handleFormChange('totalLike', event.target.value)}
                />
              </div>
              <div>
                <Input
                  label="Comments"
                  type="number"
                  placeholder="0"
                  value={form.totalComment}
                  onChange={(event) => handleFormChange('totalComment', event.target.value)}
                />
              </div>
              <div>
                <Input
                  label="Shares"
                  type="number"
                  placeholder="0"
                  value={form.totalShare}
                  onChange={(event) => handleFormChange('totalShare', event.target.value)}
                />
              </div>
              <div>
                <Input
                  label="Saved"
                  type="number"
                  placeholder="0"
                  value={form.totalSaved}
                  onChange={(event) => handleFormChange('totalSaved', event.target.value)}
                />
              </div>
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
              You can add engagement metrics now or update them later when the post is published.
            </p>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={submitting} color="green">
              {submitting ? 'Saving...' : 'Save post'}
            </Button>
          </div>
        </form>
        </Card>
      </RequirePermission>

      {showPostTable && (
        loading ? (
          <div className="skeleton h-10 w-full" />
        ) : (
          <Card>
            <div className="card-inner-table">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Export the current campaign posts or import new ones from a CSV that follows the official headers.
                </p>
                <div className="flex flex-wrap gap-2">
                  {showPostTable && (
                    <RequirePermission permission={canManageCampaigns}>
                      <Button
                        onClick={handleUpdateEngagementStats}
                        variant="outline"
                        color="blue"
                        disabled={updatingEngagement}
                        className="text-xs sm:text-sm whitespace-nowrap"
                      >
                        {updatingEngagement 
                          ? (engagementUpdateProgress 
                              ? `Updating... (${engagementUpdateProgress.current}/${engagementUpdateProgress.total})` 
                              : 'Updating...')
                          : 'Update Engagement Stats'}
                      </Button>
                    </RequirePermission>
                  )}
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
              <TableWrap>
                  <Table>
                    <THead>
                      <TR>
                        <TH>NO</TH>
                        <TH>Campaign</TH>
                        <TH>Campaign Category</TH>
                        <TH>Account</TH>
                        <TH>Post Day</TH>
                        <TH>Post Date</TH>
                        <TH>Title</TH>
                        <TH>Type</TH>
                        <TH>Content Category</TH>
                        <TH>Status</TH>
                        <TH>PIC Talent</TH>
                        <TH>PIC Editor</TH>
                        <TH>PIC Posting</TH>
                        <TH>Content Link</TH>
                        <TH>Ads on Music</TH>
                        <TH>Yellow Cart</TH>
                        <TH>TOTAL VIEW</TH>
                        <TH>LIKE</TH>
                        <TH>COMMENT</TH>
                        <TH>SHARE</TH>
                        <TH>SAVED</TH>
                        <TH>Engagement Rate</TH>
                        <TH className="!text-center">Actions</TH>
                      </TR>
                    </THead>
                    <tbody>
                      {posts.map((p, i) => {
                        const picTalentName = p.picTalent?.name || (p.picTalentId ? pics.find(pic => pic.id === p.picTalentId)?.name : null) || '—';
                        const picEditorName = p.picEditor?.name || (p.picEditorId ? pics.find(pic => pic.id === p.picEditorId)?.name : null) || '—';
                        const picPostingName = p.picPosting?.name || (p.picPostingId ? pics.find(pic => pic.id === p.picPostingId)?.name : null) || '—';
                        const accountName = p.account?.name || (p.accountId ? accounts.find(acc => acc.id === p.accountId)?.name : null) || '—';
                        const campaignName = p.campaign?.name || (p.campaignId ? campaigns.find(c => c.id === p.campaignId)?.name : null) || '—';
                        const isEditing = editingCell?.postId === p.id;
                        const isSaving = savingCell?.startsWith(`${p.id}-`);
                        const selectedCampaign = campaigns.find((c) => c.id === p.campaignId);
                        const postCampaignCategoryOptions = Array.isArray(selectedCampaign?.categories) 
                          ? selectedCampaign.categories.filter((cat) => cat).sort() 
                          : [];
                        
                        return (
                          <TR key={p.id}>
                            <TD>{i + 1}</TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'campaignId', p.campaignId)}
                              >
                                {isEditing && editingCell?.field === 'campaignId' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setCellEditValue(newValue);
                                      // Mark that a change is in progress to prevent onBlur from interfering
                                      const changeKey = `${p.id}-campaignId`;
                                      selectChangeInProgressRef.current = changeKey;
                                      // Close the cell immediately
                                      setEditingCell(null);
                                      // Save in the background with the new value
                                      void handleCellBlur(p.id, 'campaignId', true, newValue).finally(() => {
                                        // Clear the flag after a delay
                                        setTimeout(() => {
                                          selectChangeInProgressRef.current = null;
                                        }, 100);
                                      });
                                    }}
                                    onBlur={(e) => {
                                      // Skip blur handling if onChange is handling the change
                                      const changeKey = `${p.id}-campaignId`;
                                      if (selectChangeInProgressRef.current === changeKey) {
                                        return;
                                      }
                                      // If value changed from initial, onChange already handled it or will handle it
                                      const currentSelectValue = (e.target as HTMLSelectElement).value;
                                      if (currentSelectValue !== initialCellValueRef.current) {
                                        // Value changed, let onChange handle it
                                        return;
                                      }
                                      // Only save if value hasn't changed (user clicked outside without changing)
                                      void handleCellBlur(p.id, 'campaignId');
                                    }}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'campaignId')}
                                    autoFocus
                                  >
                                    {campaigns.map((campaign) => (
                                      <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-campaignId') ? 'opacity-50' : ''}>
                                    {campaignName}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'campaignCategory', p.campaignCategory || '')}
                              >
                                {isEditing && editingCell?.field === 'campaignCategory' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setCellEditValue(newValue);
                                      const changeKey = `${p.id}-campaignCategory`;
                                      selectChangeInProgressRef.current = changeKey;
                                      setEditingCell(null);
                                      void handleCellBlur(p.id, 'campaignCategory', true, newValue).finally(() => {
                                        setTimeout(() => {
                                          selectChangeInProgressRef.current = null;
                                        }, 100);
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const changeKey = `${p.id}-campaignCategory`;
                                      if (selectChangeInProgressRef.current === changeKey) {
                                        return;
                                      }
                                      const currentSelectValue = (e.target as HTMLSelectElement).value;
                                      if (currentSelectValue !== initialCellValueRef.current) {
                                        return;
                                      }
                                      void handleCellBlur(p.id, 'campaignCategory');
                                    }}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'campaignCategory')}
                                    autoFocus
                                  >
                                    {postCampaignCategoryOptions.map((cat) => (
                                      <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-campaignCategory') ? 'opacity-50' : ''}>
                                    {p.campaignCategory || '—'}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'accountId', p.accountId)}
                              >
                                {isEditing && editingCell?.field === 'accountId' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setCellEditValue(newValue);
                                      const changeKey = `${p.id}-accountId`;
                                      selectChangeInProgressRef.current = changeKey;
                                      setEditingCell(null);
                                      void handleCellBlur(p.id, 'accountId', true, newValue).finally(() => {
                                        setTimeout(() => {
                                          selectChangeInProgressRef.current = null;
                                        }, 100);
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const changeKey = `${p.id}-accountId`;
                                      if (selectChangeInProgressRef.current === changeKey) {
                                        return;
                                      }
                                      const currentSelectValue = (e.target as HTMLSelectElement).value;
                                      if (currentSelectValue !== initialCellValueRef.current) {
                                        return;
                                      }
                                      void handleCellBlur(p.id, 'accountId');
                                    }}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'accountId')}
                                    autoFocus
                                  >
                                    {accounts.map((account) => (
                                      <option key={account.id} value={account.id}>{account.name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-accountId') ? 'opacity-50' : ''}>
                                    {accountName}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>{p.postDay}</TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'postDate', p.postDate)}
                              >
                                {isEditing && editingCell?.field === 'postDate' ? (
                                  <input
                                    type="date"
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(e.target.value)}
                                    onBlur={() => handleCellBlur(p.id, 'postDate')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'postDate')}
                                    autoFocus
                                  />
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-postDate') ? 'opacity-50' : ''}>
                                    {new Date(p.postDate).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'postTitle', p.postTitle)}
                              >
                                {isEditing && editingCell?.field === 'postTitle' ? (
                                  <input
                                    type="text"
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(e.target.value)}
                                    onBlur={() => handleCellBlur(p.id, 'postTitle')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'postTitle')}
                                    autoFocus
                                  />
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-postTitle') ? 'opacity-50' : ''}>
                                    {p.postTitle}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'contentType', p.contentType)}
                              >
                                {isEditing && editingCell?.field === 'contentType' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setCellEditValue(newValue);
                                      const changeKey = `${p.id}-contentType`;
                                      selectChangeInProgressRef.current = changeKey;
                                      setEditingCell(null);
                                      void handleCellBlur(p.id, 'contentType', true, newValue).finally(() => {
                                        setTimeout(() => {
                                          selectChangeInProgressRef.current = null;
                                        }, 100);
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const changeKey = `${p.id}-contentType`;
                                      if (selectChangeInProgressRef.current === changeKey) {
                                        return;
                                      }
                                      const currentSelectValue = (e.target as HTMLSelectElement).value;
                                      if (currentSelectValue !== initialCellValueRef.current) {
                                        return;
                                      }
                                      void handleCellBlur(p.id, 'contentType');
                                    }}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'contentType')}
                                    autoFocus
                                  >
                                    {CONTENT_TYPE_OPTIONS.map((type) => (
                                      <option key={type} value={type}>{type}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-contentType') ? 'opacity-50' : ''}>
                                    {p.contentType}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'contentCategory', p.contentCategory)}
                              >
                                {isEditing && editingCell?.field === 'contentCategory' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setCellEditValue(newValue);
                                      const changeKey = `${p.id}-contentCategory`;
                                      selectChangeInProgressRef.current = changeKey;
                                      setEditingCell(null);
                                      void handleCellBlur(p.id, 'contentCategory', true, newValue).finally(() => {
                                        setTimeout(() => {
                                          selectChangeInProgressRef.current = null;
                                        }, 100);
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const changeKey = `${p.id}-contentCategory`;
                                      if (selectChangeInProgressRef.current === changeKey) {
                                        return;
                                      }
                                      const currentSelectValue = (e.target as HTMLSelectElement).value;
                                      if (currentSelectValue !== initialCellValueRef.current) {
                                        return;
                                      }
                                      void handleCellBlur(p.id, 'contentCategory');
                                    }}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'contentCategory')}
                                    autoFocus
                                  >
                                    {CONTENT_CATEGORY_OPTIONS.map((cat) => (
                                      <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-contentCategory') ? 'opacity-50' : ''}>
                                    {p.contentCategory}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'status', p.status)}
                              >
                                {isEditing && editingCell?.field === 'status' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setCellEditValue(newValue);
                                      const changeKey = `${p.id}-status`;
                                      selectChangeInProgressRef.current = changeKey;
                                      setEditingCell(null);
                                      void handleCellBlur(p.id, 'status', true, newValue).finally(() => {
                                        setTimeout(() => {
                                          selectChangeInProgressRef.current = null;
                                        }, 100);
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const changeKey = `${p.id}-status`;
                                      if (selectChangeInProgressRef.current === changeKey) {
                                        return;
                                      }
                                      const currentSelectValue = (e.target as HTMLSelectElement).value;
                                      if (currentSelectValue !== initialCellValueRef.current) {
                                        return;
                                      }
                                      void handleCellBlur(p.id, 'status');
                                    }}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'status')}
                                    autoFocus
                                  >
                                    {STATUS_OPTIONS.map((status) => (
                                      <option key={status} value={status}>{status}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={`badge ${isSaving && savingCell?.endsWith('-status') ? 'opacity-50' : ''}`}>
                                    {p.status}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'picTalentId', p.picTalentId || '')}
                              >
                                {isEditing && editingCell?.field === 'picTalentId' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setCellEditValue(newValue);
                                      const changeKey = `${p.id}-picTalentId`;
                                      selectChangeInProgressRef.current = changeKey;
                                      setEditingCell(null);
                                      void handleCellBlur(p.id, 'picTalentId', true, newValue).finally(() => {
                                        setTimeout(() => {
                                          selectChangeInProgressRef.current = null;
                                        }, 100);
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const changeKey = `${p.id}-picTalentId`;
                                      if (selectChangeInProgressRef.current === changeKey) {
                                        return;
                                      }
                                      const currentSelectValue = (e.target as HTMLSelectElement).value;
                                      if (currentSelectValue !== initialCellValueRef.current) {
                                        return;
                                      }
                                      void handleCellBlur(p.id, 'picTalentId');
                                    }}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'picTalentId')}
                                    autoFocus
                                  >
                                    {talentPics.map((pic) => (
                                      <option key={pic.id} value={pic.id}>{pic.name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-picTalentId') ? 'opacity-50' : ''}>
                                    {picTalentName}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'picEditorId', p.picEditorId || '')}
                              >
                                {isEditing && editingCell?.field === 'picEditorId' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setCellEditValue(newValue);
                                      const changeKey = `${p.id}-picEditorId`;
                                      selectChangeInProgressRef.current = changeKey;
                                      setEditingCell(null);
                                      void handleCellBlur(p.id, 'picEditorId', true, newValue).finally(() => {
                                        setTimeout(() => {
                                          selectChangeInProgressRef.current = null;
                                        }, 100);
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const changeKey = `${p.id}-picEditorId`;
                                      if (selectChangeInProgressRef.current === changeKey) {
                                        return;
                                      }
                                      const currentSelectValue = (e.target as HTMLSelectElement).value;
                                      if (currentSelectValue !== initialCellValueRef.current) {
                                        return;
                                      }
                                      void handleCellBlur(p.id, 'picEditorId');
                                    }}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'picEditorId')}
                                    autoFocus
                                  >
                                    {editorPics.map((pic) => (
                                      <option key={pic.id} value={pic.id}>{pic.name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-picEditorId') ? 'opacity-50' : ''}>
                                    {picEditorName}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'picPostingId', p.picPostingId || '')}
                              >
                                {isEditing && editingCell?.field === 'picPostingId' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setCellEditValue(newValue);
                                      const changeKey = `${p.id}-picPostingId`;
                                      selectChangeInProgressRef.current = changeKey;
                                      setEditingCell(null);
                                      void handleCellBlur(p.id, 'picPostingId', true, newValue).finally(() => {
                                        setTimeout(() => {
                                          selectChangeInProgressRef.current = null;
                                        }, 100);
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const changeKey = `${p.id}-picPostingId`;
                                      if (selectChangeInProgressRef.current === changeKey) {
                                        return;
                                      }
                                      const currentSelectValue = (e.target as HTMLSelectElement).value;
                                      if (currentSelectValue !== initialCellValueRef.current) {
                                        return;
                                      }
                                      void handleCellBlur(p.id, 'picPostingId');
                                    }}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'picPostingId')}
                                    autoFocus
                                  >
                                    {postingPics.map((pic) => (
                                      <option key={pic.id} value={pic.id}>{pic.name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-picPostingId') ? 'opacity-50' : ''}>
                                    {picPostingName}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'contentLink', p.contentLink || '')}
                              >
                                {isEditing && editingCell?.field === 'contentLink' ? (
                                  <input
                                    type="text"
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(e.target.value)}
                                    onBlur={() => handleCellBlur(p.id, 'contentLink')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'contentLink')}
                                    autoFocus
                                  />
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-contentLink') ? 'opacity-50' : ''}>
                                    {p.contentLink ? (
                                      <a href={p.contentLink} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600 dark:text-blue-400" style={{ color: '#2563eb' }}>
                                        Link
                                      </a>
                                    ) : '—'}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'adsOnMusic', p.adsOnMusic)}
                              >
                                {isEditing && editingCell?.field === 'adsOnMusic' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setCellEditValue(newValue);
                                      const changeKey = `${p.id}-adsOnMusic`;
                                      selectChangeInProgressRef.current = changeKey;
                                      setEditingCell(null);
                                      void handleCellBlur(p.id, 'adsOnMusic', true, newValue).finally(() => {
                                        setTimeout(() => {
                                          selectChangeInProgressRef.current = null;
                                        }, 100);
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const changeKey = `${p.id}-adsOnMusic`;
                                      if (selectChangeInProgressRef.current === changeKey) {
                                        return;
                                      }
                                      const currentSelectValue = (e.target as HTMLSelectElement).value;
                                      if (currentSelectValue !== initialCellValueRef.current) {
                                        return;
                                      }
                                      void handleCellBlur(p.id, 'adsOnMusic');
                                    }}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'adsOnMusic')}
                                    autoFocus
                                  >
                                    <option value="false">No</option>
                                    <option value="true">Yes</option>
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-adsOnMusic') ? 'opacity-50' : ''}>
                                    {p.adsOnMusic ? 'Yes' : 'No'}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'yellowCart', p.yellowCart)}
                              >
                                {isEditing && editingCell?.field === 'yellowCart' ? (
                                  <select
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => {
                                      const newValue = e.target.value;
                                      setCellEditValue(newValue);
                                      const changeKey = `${p.id}-yellowCart`;
                                      selectChangeInProgressRef.current = changeKey;
                                      setEditingCell(null);
                                      void handleCellBlur(p.id, 'yellowCart', true, newValue).finally(() => {
                                        setTimeout(() => {
                                          selectChangeInProgressRef.current = null;
                                        }, 100);
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const changeKey = `${p.id}-yellowCart`;
                                      if (selectChangeInProgressRef.current === changeKey) {
                                        return;
                                      }
                                      const currentSelectValue = (e.target as HTMLSelectElement).value;
                                      if (currentSelectValue !== initialCellValueRef.current) {
                                        return;
                                      }
                                      void handleCellBlur(p.id, 'yellowCart');
                                    }}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'yellowCart')}
                                    autoFocus
                                  >
                                    <option value="false">No</option>
                                    <option value="true">Yes</option>
                                  </select>
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-yellowCart') ? 'opacity-50' : ''}>
                                    {p.yellowCart ? 'Yes' : 'No'}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'totalView', p.totalView)}
                              >
                                {isEditing && editingCell?.field === 'totalView' ? (
                                  <input
                                    type="number"
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(sanitizeNumberInput(e.target.value))}
                                    onBlur={() => handleCellBlur(p.id, 'totalView')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'totalView')}
                                    autoFocus
                                  />
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-totalView') ? 'opacity-50' : ''}>
                                    {p.totalView}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'totalLike', p.totalLike)}
                              >
                                {isEditing && editingCell?.field === 'totalLike' ? (
                                  <input
                                    type="number"
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(sanitizeNumberInput(e.target.value))}
                                    onBlur={() => handleCellBlur(p.id, 'totalLike')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'totalLike')}
                                    autoFocus
                                  />
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-totalLike') ? 'opacity-50' : ''}>
                                    {p.totalLike}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'totalComment', p.totalComment)}
                              >
                                {isEditing && editingCell?.field === 'totalComment' ? (
                                  <input
                                    type="number"
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(sanitizeNumberInput(e.target.value))}
                                    onBlur={() => handleCellBlur(p.id, 'totalComment')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'totalComment')}
                                    autoFocus
                                  />
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-totalComment') ? 'opacity-50' : ''}>
                                    {p.totalComment}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'totalShare', p.totalShare)}
                              >
                                {isEditing && editingCell?.field === 'totalShare' ? (
                                  <input
                                    type="number"
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(sanitizeNumberInput(e.target.value))}
                                    onBlur={() => handleCellBlur(p.id, 'totalShare')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'totalShare')}
                                    autoFocus
                                  />
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-totalShare') ? 'opacity-50' : ''}>
                                    {p.totalShare}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>
                              <div 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[2rem] flex items-center min-w-0 max-w-full overflow-hidden rounded-md transition-colors duration-150 px-1 -mx-1"
                                onClick={() => handleCellClick(p.id, 'totalSaved', p.totalSaved)}
                              >
                                {isEditing && editingCell?.field === 'totalSaved' ? (
                                  <input
                                    type="number"
                                    className="w-full border-none bg-transparent p-1 text-sm text-inherit dark:text-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded min-w-0"
                                    value={cellEditValue}
                                    onChange={(e) => setCellEditValue(sanitizeNumberInput(e.target.value))}
                                    onBlur={() => handleCellBlur(p.id, 'totalSaved')}
                                    onKeyDown={(e) => handleCellKeyDown(e, p.id, 'totalSaved')}
                                    autoFocus
                                  />
                                ) : (
                                  <span className={isSaving && savingCell?.endsWith('-totalSaved') ? 'opacity-50' : ''}>
                                    {p.totalSaved}
                                  </span>
                                )}
                              </div>
                            </TD>
                            <TD>{(p.engagementRate * 100).toFixed(2)}%</TD>
                            <TD>
                              <div className="flex gap-1.5 justify-center">
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
