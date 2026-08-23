import { useEffect, useRef, useState } from "react";
// @ts-expect-error - JS module without declarations
import i18n from "../pages/Landing/i18n/index";

import { useSidebar } from "../context/SidebarContext";
import { ThemeToggleButton } from "../components/common/ThemeToggleButton";
// import NotificationDropdown from "../components/header/NotificationDropdown";
import UserDropdown from "../components/header/UserDropdown";
import { useLocale } from "../context/LocaleContext";
import { useCompanyFilter } from "../context/CompanyFilterContext";
import { Search, Loader2, X } from "lucide-react";
import { useNavigate } from 'react-router';
import { applicantsService } from "../services/applicantsService";
import { paths } from "../router/Paths";
import type { Applicant } from "../types/applicants";

const AppHeader: React.FC = () => {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const { locale, setLocale, t, dir } = useLocale();
  const { selectedCompanyId, setSelectedCompanyId, resetFilter, companyOptions, companyMap } = useCompanyFilter();

  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Applicant[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  const toggleApplicationMenu = () => {
    setApplicationMenuOpen(!isApplicationMenuOpen);
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const companyDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(e.target as Node)) {
        setIsCompanyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const companyId = selectedCompanyId ?? companyOptions.map(c => c.id);

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await applicantsService.searchApplicants({
          q: searchQuery.trim(),
          companyId: companyId.length > 0 ? companyId : undefined,
          page: 1,
          limit: 20,
        });
        setSearchResults(res ?? []);
        setShowSearchResults(true);
      } catch {
        // ignore
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCompanyId, companyOptions]);

  const handleSelectResult = (applicant: Applicant) => {
    setShowSearchResults(false);
    setSearchQuery('');
    navigate(paths.applicants.details(applicant._id));
  };

  const selectedCompany = selectedCompanyId ? companyMap[selectedCompanyId] : null;
  const selectedName = selectedCompany
    ? (locale === 'ar' && selectedCompany?.name?.ar ? selectedCompany.name.ar : (typeof selectedCompany?.name === 'string' ? selectedCompany.name : selectedCompany?.name?.en || ''))
    : t('allCompanies', 'common');
  const selectedLogo = selectedCompany?.logoPath;

  return (
    <header className="sticky top-0 flex w-full bg-white border-gray-200 z-50 pt-[env(safe-area-inset-top)] dark:border-gray-800 dark:bg-gray-900 lg:border-b">
      <div className="flex flex-col items-center justify-between grow lg:flex-row lg:px-6">
        <div className="flex items-center justify-between w-full gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-800 sm:gap-4 lg:justify-normal lg:border-b-0 lg:px-0 lg:py-4">
          <button
            className={`${dir === 'rtl' ? 'mr-2' : 'ml-2'} items-center justify-center w-10 h-9 sm:w-10 sm:h-10 text-gray-500 border-gray-200 rounded-lg z-99999 dark:border-gray-800 lg:flex dark:text-gray-400 lg:h-11 lg:w-11 lg:border`}
            onClick={handleToggle}
            aria-label="Toggle Sidebar"
          >
            {isMobileOpen ? (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <svg
                width="16"
                height="12"
                viewBox="0 0 16 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M0.583252 1C0.583252 0.585788 0.919038 0.25 1.33325 0.25H14.6666C15.0808 0.25 15.4166 0.585786 15.4166 1C15.4166 1.41421 15.0808 1.75 14.6666 1.75L1.33325 1.75C0.919038 1.75 0.583252 1.41422 0.583252 1ZM0.583252 11C0.583252 10.5858 0.919038 10.25 1.33325 10.25L14.6666 10.25C15.0808 10.25 15.4166 10.5858 15.4166 11C15.4166 11.4142 15.0808 11.75 14.6666 11.75L1.33325 11.75C0.919038 11.75 0.583252 11.4142 0.583252 11ZM1.33325 5.25C0.919038 5.25 0.583252 5.58579 0.583252 6C0.583252 6.41421 0.919038 6.75 1.33325 6.75L7.99992 6.75C8.41413 6.75 8.74992 6.41421 8.74992 6C8.74992 5.58579 8.41413 5.25 7.99992 5.25L1.33325 5.25Z"
                  fill="currentColor"
                />
              </svg>
            )}
            {/* Cross Icon */}
          </button>

          <div ref={searchContainerRef} className="relative hidden sm:block">
            <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
              {isSearching ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-slate-400" />
              ) : (
                <Search className="size-4 shrink-0 text-slate-400" />
              )}
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    setShowSearchResults(false);
                    navigate(`/applicants?search=${encodeURIComponent(searchQuery.trim())}`);
                  }
                }}
                onFocus={() => { if (searchResults.length > 0) setShowSearchResults(true); }}
                placeholder="Deep Searching..."
                className="w-44 bg-transparent outline-none text-slate-700 placeholder-slate-400 dark:text-slate-200 dark:placeholder-slate-500"
              />
    
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowSearchResults(false);
                  navigate('/applicants');
                }}
                className="flex items-center justify-center rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                title="Reset filters"
              >
                <X className="size-3.5" />
              </button>
            </div>
            {showSearchResults && (
              <div className="absolute left-0 z-50 mt-1 w-80 overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800 max-h-80">
                {searchResults.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No results found
                  </div>
                ) : (
                  searchResults.map((applicant) => (
                    <button
                      key={applicant._id}
                      type="button"
                      onClick={() => handleSelectResult(applicant)}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-700/50"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600 dark:bg-slate-600 dark:text-slate-300">
                        {(applicant.fullName || applicant.firstName || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-slate-800 dark:text-slate-100">
                          {applicant.fullName || `${applicant.firstName || ''} ${applicant.lastName || ''}`.trim() || 'Unknown'}
                        </div>
                        {applicant.email && (
                          <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {applicant.email}
                          </div>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <button
            onClick={toggleApplicationMenu}
            className={`${dir === 'rtl' ? 'ml-5' : 'mr-5'} flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 text-gray-700 rounded-lg z-99999 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden`}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M3 20c2.5-4 6.5-5 9-5s6.5 1 9 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div
          className={`${
            isApplicationMenuOpen ? "flex" : "hidden"
          } items-center justify-end w-full gap-2 px-3 py-3 lg:flex shadow-theme-md lg:shadow-none`}
        >
          <button
            onClick={() => {
              const newLang = locale === 'en' ? 'ar' : 'en';
              setLocale(newLang);
              localStorage.setItem('landing-lang', newLang);
              i18n.changeLanguage(newLang);
            }}
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:border-gray-800 dark:hover:bg-gray-800"
            aria-label={t('language', 'common')}
          >
            <span className="text-xs font-semibold uppercase">
              {locale === 'en' ? 'AR' : 'EN'}
            </span>
          </button>
          <div className="flex items-center gap-1" ref={companyDropdownRef}>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                  className="flex w-56 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200"
                >
                  {selectedLogo && !isCompanyDropdownOpen ? (
                    <img
                      src={selectedLogo.replace('/upload/', '/upload/q_10,w_32/')}
                      alt=""
                      className="size-5 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex size-5 shrink-0 items-center justify-center rounded bg-slate-200 text-[11px] font-bold leading-none text-slate-600 dark:bg-slate-600 dark:text-slate-300">
                      {isCompanyDropdownOpen ? '▼' : (selectedName || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="flex-1 truncate text-left">{selectedName}</span>
                </button>

                  {isCompanyDropdownOpen && (
                  <div className="absolute right-0 z-30 mt-1 w-64 overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                    {companyOptions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => { setSelectedCompanyId(null); setIsCompanyDropdownOpen(false); }}
                        className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
                          !selectedCompanyId
                            ? 'bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-100'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        {t('allCompanies', 'common')}
                      </button>
                    )}
                    {companyOptions.map((c) => {
                      const name = locale === 'ar' && c.titleAr ? c.titleAr : c.title;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setSelectedCompanyId(c.id); setIsCompanyDropdownOpen(false); }}
                          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
                            selectedCompanyId === c.id
                              ? 'bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-100'
                              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/50'
                          }`}
                        >
                          {c.logoPath ? (
                            <img
                              src={c.logoPath.replace('/upload/', '/upload/q_10,w_32/')}
                              alt=""
                              className="size-6 shrink-0 rounded object-cover"
                            />
                          ) : (
                            <div className={`flex size-6 shrink-0 items-center justify-center rounded text-[10px] font-bold uppercase ${
                              selectedCompanyId === c.id
                                ? 'bg-slate-300 text-slate-800 dark:bg-slate-500 dark:text-white'
                                : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                            }`}>
                              {name.charAt(0)}
                            </div>
                          )}
                          <span className="flex-1 truncate">{name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {selectedCompanyId && companyOptions.length > 1 && (
                <button
                  onClick={() => { resetFilter(); setIsCompanyDropdownOpen(false); }}
                  className="flex items-center justify-center rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                  title={t('clear', 'common')}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          <ThemeToggleButton />
          <UserDropdown />
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
