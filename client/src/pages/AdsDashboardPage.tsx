import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { getApiCacheKey, getCachedValue } from '../lib/cache';
import { shouldIgnoreRequestError } from '../lib/requestUtils';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import { TableWrap, Table, THead, TH, TR, TD } from '../components/ui/Table';

type Campaign = {
  id: string;
  name: string;
  endDate: string;
  brandName?: string | null;
  quotationNumber?: string | null;
};

type CampaignData = {
  campaign: Campaign;
  eod: number;
  currentViews: number;
  remainingViews: number;
  budgetAds: number;
  remBudgetAds: number;
  todayBudget: number;
};

export default function AdsDashboardPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allCampaignData, setAllCampaignData] = useState<CampaignData[]>([]);
  const [filters, setFilters] = useState({
    name: '',
    brandName: '',
    quotationNumber: '',
  });
  const [pagination, setPagination] = useState({
    limit: 25,
    offset: 0,
  });
  const hasHydratedFromCacheRef = useRef(false);

  const ACTIVE_CAMPAIGNS_CACHE_KEY = getApiCacheKey('/campaigns?status=ACTIVE');

  const buildDashboardData = useCallback((campaigns: Campaign[], kpiMap: Map<string, any[]>) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return campaigns.map((campaign) => {
      const kpis = kpiMap.get(campaign.id) ?? [];
      const viewsKpi = kpis.find((k: any) => k.category === 'VIEWS' && !k.accountId);
      const targetViews = viewsKpi?.target || 0;
      const currentViews = viewsKpi?.actual || 0;

      const endDate = new Date(campaign.endDate);
      endDate.setHours(0, 0, 0, 0);
      const eod = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
      const remainingViews = Math.max(0, targetViews - currentViews);
      const budgetAds = (targetViews / 60) * 500;
      const remBudgetAds = (remainingViews / 60) * 500;
      const todayBudget = eod > 0 ? remBudgetAds / eod : 0;

      return {
        campaign,
        eod,
        currentViews,
        remainingViews,
        budgetAds,
        remBudgetAds,
        todayBudget,
      };
    });
  }, []);

  useEffect(() => {
    if (!token || hasHydratedFromCacheRef.current) return;
    const cachedCampaigns = getCachedValue<Campaign[]>(ACTIVE_CAMPAIGNS_CACHE_KEY);
    if (cachedCampaigns && cachedCampaigns.length > 0) {
      const kpiMap = new Map<string, any[]>();
      cachedCampaigns.forEach((campaign) => {
        const cachedKpis = getCachedValue<any[]>(getApiCacheKey(`/campaigns/${campaign.id}/kpis`));
        if (cachedKpis) {
          kpiMap.set(campaign.id, cachedKpis);
        }
      });
      const data = buildDashboardData(cachedCampaigns, kpiMap);
      setAllCampaignData(data);
      setLoading(false);
      hasHydratedFromCacheRef.current = true;
    }
  }, [token, buildDashboardData]);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    setLoading(!hasHydratedFromCacheRef.current);
    try {
      // Fetch all active campaigns
      const campaigns: Campaign[] = await api('/campaigns?status=ACTIVE', { token });
      
      if (campaigns.length === 0) {
        setAllCampaignData([]);
        setLoading(false);
        return;
      }

      const kpiPromises = campaigns.map(campaign =>
        api(`/campaigns/${campaign.id}/kpis`, { token }).catch(() => [])
      );

      const kpiResults = await Promise.all(kpiPromises);

      const kpiMap = new Map<string, any[]>();
      campaigns.forEach((campaign, index) => {
        const kpis: any[] = Array.isArray(kpiResults[index]) ? kpiResults[index] : [];
        kpiMap.set(campaign.id, kpis);
      });

      const data = buildDashboardData(campaigns, kpiMap);
      
      setAllCampaignData(data);
    } catch (error: any) {
      if (shouldIgnoreRequestError(error)) {
        return;
      }
      console.error('Failed to fetch ads dashboard data:', error);
      setAllCampaignData([]);
    } finally {
      setLoading(false);
    }
  };

  const getUniqueBrands = useMemo(() => {
    const brands = new Set<string>();
    allCampaignData.forEach(data => {
      if (data.campaign.brandName && data.campaign.brandName.trim()) {
        brands.add(data.campaign.brandName.trim());
      }
    });
    return Array.from(brands).sort();
  }, [allCampaignData]);

  const applyFilters = useCallback((data: CampaignData[]) => {
    return data.filter((item) => {
      const campaign = item.campaign;
      
      // Filter by campaign name
      if (filters.name.trim()) {
        const nameLower = filters.name.toLowerCase();
        if (!campaign.name.toLowerCase().includes(nameLower)) return false;
      }

      // Filter by brand name
      if (filters.brandName) {
        if (!campaign.brandName || campaign.brandName.trim().toLowerCase() !== filters.brandName.toLowerCase()) {
          return false;
        }
      }

      // Filter by quotation number
      if (filters.quotationNumber.trim()) {
        const quotationLower = filters.quotationNumber.toLowerCase();
        if (!campaign.quotationNumber || !campaign.quotationNumber.toLowerCase().includes(quotationLower)) {
          return false;
        }
      }

      return true;
    });
  }, [filters]);

  const filteredCampaignData = useMemo(() => {
    return applyFilters(allCampaignData);
  }, [allCampaignData, applyFilters]);

  // Client-side pagination
  const paginatedCampaignData = useMemo(() => {
    const start = pagination.offset;
    const end = start + pagination.limit;
    return filteredCampaignData.slice(start, end);
  }, [filteredCampaignData, pagination]);

  const totalPages = Math.ceil(filteredCampaignData.length / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  const handleClearFilters = () => {
    setFilters({
      name: '',
      brandName: '',
      quotationNumber: '',
    });
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, offset: 0 })); // Reset to first page when filtering
  };

  const handleRowsPerPageChange = (newLimit: number) => {
    setPagination({ limit: newLimit, offset: 0 });
  };

  const hasFilters = Boolean(
    filters.name.trim() ||
    filters.brandName ||
    filters.quotationNumber.trim()
  );

  const totalBudgetToday = useMemo(() => {
    return filteredCampaignData.reduce((sum, data) => sum + data.todayBudget, 0);
  }, [filteredCampaignData]);

  const formatNumber = (num: number): string => {
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 2 
    });
  };

  const formatCurrency = (num: number): string => {
    return `Rp ${num.toLocaleString('id-ID', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    })}`;
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="page-title">Ads Dashboard</h1>
      </div>

      <Card>
        <div className="card-inner-table">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2 sm:gap-3 mb-4">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2 w-full">
              <Input
                label={<span className="text-xs">Campaign Name</span>}
                value={filters.name}
                onChange={e => handleFilterChange('name', e.target.value)}
                placeholder="Search by name..."
                className="text-sm py-1.5"
              />
              <Select 
                label={<span className="text-xs">Brand Name</span>}
                value={filters.brandName} 
                onChange={e => handleFilterChange('brandName', e.target.value)}
                className="text-sm py-1.5"
              >
                <option value="">All Brands</option>
                {getUniqueBrands.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </Select>
              <Input
                label={<span className="text-xs">Quotation Number</span>}
                value={filters.quotationNumber}
                onChange={e => handleFilterChange('quotationNumber', e.target.value)}
                placeholder="Search by quotation..."
                className="text-sm py-1.5"
              />
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <div className="text-right">
                <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Total Budget Today</div>
                <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {formatCurrency(totalBudgetToday)}
                </div>
              </div>
              <Button variant="outline" onClick={handleClearFilters} className="text-sm py-1 px-2">
                Reset Filters
              </Button>
            </div>
          </div>
          {loading ? (
            <div className="py-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-500">Loading...</p>
            </div>
          ) : filteredCampaignData.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-500 text-lg">No active campaigns found</p>
              <p className="text-gray-400 text-sm mt-2">
                {hasFilters
                  ? 'Try adjusting your filters to see more results.'
                  : 'There are no active campaigns available.'}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Showing {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, filteredCampaignData.length)} of {filteredCampaignData.length}
                  {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Rows per page:
                  </label>
                  <Select
                    value={pagination.limit.toString()}
                    onChange={e => handleRowsPerPageChange(Number(e.target.value))}
                    className="text-sm py-1 px-2 w-20"
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="200">200</option>
                  </Select>
                </div>
              </div>
              <TableWrap>
                <Table>
                  <THead>
                    <TR>
                      <TH>No</TH>
                      <TH>Campaign</TH>
                      <TH>EoD</TH>
                      <TH>Current View</TH>
                      <TH>Remaining Views</TH>
                      <TH>Budget Ads</TH>
                      <TH>Rem. Budget Ads</TH>
                      <TH>Today Budget</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {paginatedCampaignData.map((data, index) => (
                      <TR key={data.campaign.id}>
                        <TD>{pagination.offset + index + 1}</TD>
                        <TD>
                          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                            {data.campaign.name}
                          </span>
                        </TD>
                        <TD>{data.eod}</TD>
                        <TD>{formatNumber(data.currentViews)}</TD>
                        <TD>{formatNumber(data.remainingViews)}</TD>
                        <TD>{formatCurrency(data.budgetAds)}</TD>
                        <TD>{formatCurrency(data.remBudgetAds)}</TD>
                        <TD>{formatCurrency(data.todayBudget)}</TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
              {totalPages > 1 && (
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                    disabled={pagination.offset === 0}
                    className="text-sm"
                  >
                    Previous
                  </Button>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Page {currentPage} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                    disabled={pagination.offset + pagination.limit >= filteredCampaignData.length}
                    className="text-sm"
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

