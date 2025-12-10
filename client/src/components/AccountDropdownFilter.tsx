import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

const ACCOUNT_OPTION_RENDER_LIMIT = 120;

export type AccountDropdownOption = {
  id: string;
  name?: string | null;
  accountType?: 'CROSSBRAND' | 'NEW_PERSONA' | 'KOL' | 'PROXY';
};

type Props = {
  label?: ReactNode;
  accounts: AccountDropdownOption[];
  selectedAccountId: string;
  onSelect: (value: string) => void;
};

export default function AccountDropdownFilter({ label = <span className="text-xs">Account</span>, accounts, selectedAccountId, onSelect }: Props) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) || null,
    [accounts, selectedAccountId],
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 120);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (!selectedAccountId) {
      setSearchTerm('');
    }
  }, [selectedAccountId]);

  const { filteredAccountOptions, totalFilteredAccounts } = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) {
      return {
        filteredAccountOptions: accounts.slice(0, ACCOUNT_OPTION_RENDER_LIMIT),
        totalFilteredAccounts: accounts.length,
      };
    }

    const matches: AccountDropdownOption[] = [];
    let total = 0;
    for (const account of accounts) {
      const name = account.name || '';
      if (name.toLowerCase().includes(query)) {
        total += 1;
        if (matches.length < ACCOUNT_OPTION_RENDER_LIMIT) {
          matches.push(account);
        }
      }
    }

    return { filteredAccountOptions: matches, totalFilteredAccounts: total };
  }, [debouncedSearch, accounts]);

  const handleSelect = (value: string, name: string) => {
    onSelect(value);
    setSearchTerm(value ? name : '');
    setIsOpen(false);
  };

  const displayValue = searchTerm || selectedAccount?.name || '';

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          className="select text-sm py-1.5 cursor-text text-gray-900 dark:text-gray-100 placeholder:text-gray-900 dark:placeholder:text-gray-100"
          placeholder="All accounts"
          value={displayValue}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onChange={(e) => {
            const newValue = e.target.value;
            setSearchTerm(newValue);
            if (newValue === '') {
              onSelect('');
            }
            setIsOpen(true);
          }}
          autoComplete="off"
        />
      </div>
      {isOpen && (
        <div
          className="absolute z-20 mt-1 w-full rounded-lg border shadow-lg overflow-hidden"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          <div className="max-h-60 overflow-y-auto">
            <button
              type="button"
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${selectedAccountId === '' ? 'bg-gray-50 dark:bg-gray-800/40' : ''}`}
              onClick={() => handleSelect('', '')}
            >
              All accounts
            </button>
            {filteredAccountOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                No accounts found
              </div>
            ) : (
              filteredAccountOptions.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${selectedAccountId === account.id ? 'bg-gray-50 dark:bg-gray-800/40' : ''}`}
                  onClick={() => handleSelect(account.id, account.name || '')}
                >
                  {account.name}
                </button>
              ))
            )}
            {totalFilteredAccounts > ACCOUNT_OPTION_RENDER_LIMIT && (
              <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-t" style={{ borderColor: 'var(--border-color)' }}>
                Showing first {ACCOUNT_OPTION_RENDER_LIMIT} of {totalFilteredAccounts} matches. Refine your search to narrow results.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
