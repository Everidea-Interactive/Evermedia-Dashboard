export type JwtUserPayload = {
  id: string;
  email: string;
  role: 'ADMIN' | 'CAMPAIGN_MANAGER' | 'OPERATOR' | 'VIEWER';
  name?: string;
};

export type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
};

