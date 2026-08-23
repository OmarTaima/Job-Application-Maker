import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';

// Assume these icons are imported from an icon library
import { ChevronDownIcon, GridIcon, HorizontaLDots, TaskIcon } from '../icons';
import { useSidebar } from '../context/SidebarContext';
import { useAuth } from '../context/AuthContext';
import { useCompanies } from '../hooks/queries/useCompanies';
import { useLocale } from '../context/LocaleContext';

type NavItem = {
  name: string;
  tKey?: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; tKey?: string; path: string; pro?: boolean; new?: boolean }[];
};

const adminItems: NavItem[] = [
  {
    icon: <TaskIcon />,
    name: 'User Management',
    tKey: 'userManagement',
    subItems: [
      { name: 'Users', tKey: 'users', path: '/users', pro: false },
      { name: 'Permissions & Roles', tKey: 'permissionsRoles', path: '/permissions', pro: false },
      { name: 'Recommended Fields', tKey: 'recommendedFields', path: '/recommended-fields', pro: false },
    ],
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { hasPermission, user } = useAuth();
  const { t, dir } = useLocale();
  const location = useLocation();
  const { data: companies = [] } = useCompanies();

  // Get applicant pages from companies data (from /auth/me)
  const applicantPageSubItems = useMemo(() => {
    const seen = new Set<string>();

    // Collect applicant pages from all companies the user has access to
    const allPages: any[] = [];

    companies.forEach((company: any) => {
      const pages = company?.settings?.applicantPages ?? [];
      if (Array.isArray(pages)) {
        allPages.push(...pages);
      }
    });

    return allPages
      .filter((p: any) => {
        if (seen.has(p.name)) return false;
        seen.add(p.name);
        return true;
      })
      .map((p: any) => ({
        name: p.name,
        tKey: undefined as string | undefined,
        path: `/applicants/page/${encodeURIComponent(p.name)}?statuses=${(p.statuses || []).map(encodeURIComponent).join(',')}${(p.jobPositions?.length ? `&jobPositions=${p.jobPositions.map(encodeURIComponent).join(',')}` : '')}`,
        pro: false,
      }));
  }, [companies]);

  const hasSingleAssignedCompany = useMemo(() => {
    const roleName = user?.roleId?.name?.toLowerCase?.();
    const isAdminRole = roleName === 'admin' || roleName === 'super admin';
    if (isAdminRole) return false;

    const fromCompanies = Array.isArray(user?.companies)
      ? user.companies
          .map((c: any) =>
            typeof c?.companyId === 'string' ? c.companyId : c?.companyId?._id
          )
          .filter(Boolean)
      : [];

    const fromAssigned = Array.isArray((user as any)?.assignedcompanyId)
      ? (user as any).assignedcompanyId.filter(Boolean)
      : [];

    const mergedIds = Array.from(
      new Set([...fromCompanies, ...fromAssigned].map(String))
    );

    return mergedIds.length === 1;
  }, [user]);

  // Check if user has read access to admin features
  const hasUserManagementRead = hasPermission('User Management', 'read');
  const hasRoleManagementRead = hasPermission('Role Management', 'read');
  const hasSettingsManagementRead = hasPermission(
    'Settings Management',
    'read'
  );

  // Show admin section if user has read access to any admin feature
  const hasAdminPermissions =
    hasUserManagementRead || hasRoleManagementRead || hasSettingsManagementRead;

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: 'main' | 'admin';
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname]
  );

  const navItems: NavItem[] = [
    {
      icon: <GridIcon />,
      name: 'Home',
      tKey: 'home',
      path: '/home',
    },
    {
      icon: <GridIcon />,
      name: 'Applicants',
      tKey: 'applicants',
      subItems: [
        { name: 'All Applicants', tKey: 'allApplicants', path: '/applicants', pro: false },
        {
          name: 'Blue Caller Applicants',
          tKey: 'blueCallerApplicants',
          path: '/applicants/blue-caller',
          pro: false,
        },
        ...applicantPageSubItems,
      ],
    },
    {
      icon: <TaskIcon />,
      name: 'Mail Preview',
      tKey: 'mailPreview',
      path: '/applicants/mail-preview',
    },
    ...(hasPermission('Offer Management', 'read')
      ? [
          {
            icon: <TaskIcon />,
            name: 'Job Offers',
            tKey: 'jobOffers',
            path: '/job-offers',
          },
        ]
      : []),
    ...(hasPermission('Contract Management', 'read')
      ? [
          {
            icon: <TaskIcon />,
            name: 'Job Contracts',
            tKey: 'jobContracts',
            path: '/job-contracts',
          },
        ]
      : []),
    ...(hasPermission('Inquiry Management', 'read')
      ? [
          {
            icon: <TaskIcon />,
            name: 'Support Inbox',
            tKey: 'inquiryPreview',
            path: '/inquiries',
          },
        ]
      : []),
    {
      icon: <TaskIcon />,
      name: 'Company Settings',
      tKey: 'companySettings',
      subItems: [
        { name: 'Create Company', tKey: 'createCompany', path: '/recruiting', pro: false },
        { name: 'Companies', tKey: 'companies', path: '/companies', pro: false },
        { name: 'Subscription', tKey: 'subscription', path: '/recruiting/subscription', pro: false },
        {
          name: 'Mail Settings',
          tKey: 'mailSettings',
          path: '/recruiting/company-settings',
          pro: false,
        },
        {
          name: 'General Settings',
          tKey: 'generalSettings',
          path: '/recruiting/interview-settings',
          pro: false,
        },
      ],
    },
    {
      icon: <GridIcon />,
      name: 'Jobs Management',
      tKey: 'jobsManagement',
      subItems: [
        { name: 'Create Job', tKey: 'createJob', path: '/create-job', pro: false },
        { name: 'Jobs', tKey: 'jobs', path: '/jobs', pro: false },
      ],
    },
    {
      icon: <GridIcon />,
      name: 'User Settings',
      tKey: 'userSettings',
      subItems: [
        { name: 'Saved Fields', tKey: 'savedFields', path: '/recruiting/saved-fields', pro: false },
        {
          name: 'Saved Questions',
          tKey: 'savedQuestions',
          path: '/recruiting/saved-questions',
          pro: false,
        },
      ],
    },
  ];

  useEffect(() => {
    let submenuMatched = false;
    ['main', 'admin'].forEach((menuType) => {
      const items = menuType === 'main' ? navItems : adminItems;
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (isActive(subItem.path)) {
              setOpenSubmenu({
                type: menuType as 'main' | 'admin',
                index,
              });
              submenuMatched = true;
            }
          });
        }
      });
    });

    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [location.pathname, location.search, isActive, applicantPageSubItems]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: 'main' | 'admin') => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  const renderMenuItems = (items: NavItem[], menuType: 'main' | 'admin') => {
    const filterSubItems = (
      subItems: { name: string; tKey?: string; path: string; pro?: boolean; new?: boolean }[]
    ) => {
      return subItems.filter((subItem) => {
        if (subItem.path === '/applicants')
          return hasPermission('Applicant Management', 'read');
        if (subItem.path === '/applicants/blue-caller')
          return hasPermission('Applicant Management', 'create');
        if (subItem.path === '/applicants/mail-preview')
          return hasPermission('Mail Management', 'read');
        if (subItem.path === '/recruiting')
          return hasPermission('Company Management', 'create');
        if (subItem.path === '/companies')
          return hasPermission('Company Management', 'read');
        if (subItem.path === '/recruiting/subscription')
          return hasPermission('Billing Management', 'write');
        if (subItem.path === '/recruiting/company-settings')
          return hasPermission('Mail Management', 'read');
        if (subItem.path === '/recruiting/interview-settings')
          return (
            hasPermission('Interview Settings Management', 'read') ||
            hasPermission('Company Management', 'read') ||
            hasPermission('Settings Management', 'read')
          );
        if (subItem.path === '/create-job')
          return hasPermission('Job Position Management', 'create');
        if (subItem.path === '/jobs')
          return hasPermission('Job Position Management', 'read');
        if (subItem.path === '/users')
          return hasPermission('User Management', 'read');
        if (subItem.path === '/permissions')
          return hasPermission('Role Management', 'read');
        if (subItem.path === '/recommended-fields')
          return (
            hasPermission('Settings Management', 'create') &&
            hasPermission('Settings Management', 'write')
          );
        if (subItem.path === '/recruiting/saved-fields') return true;
        if (subItem.path === '/recruiting/saved-questions') return true;
        return true;
      });
    };

    const filteredItems = items;

    return (
      <ul className="flex flex-col gap-4">
        {filteredItems.map((nav, index) => {
          const visibleSubItems = nav.subItems
            ? filterSubItems(nav.subItems)
            : undefined;

          if (nav.subItems && visibleSubItems && visibleSubItems.length === 0) {
            return null;
          }

          return (
            <li key={nav.name}>
              {visibleSubItems ? (
                <>
                  <button
                    onClick={() => handleSubmenuToggle(index, menuType)}
                    className={`menu-item group ${
                      openSubmenu?.type === menuType &&
                      openSubmenu?.index === index
                        ? 'menu-item-active'
                        : 'menu-item-inactive'
                    } cursor-pointer ${
                      !isExpanded && !isHovered
                        ? 'lg:justify-center'
                        : 'lg:justify-start'
                    }`}
                  >
                    <span
                      className={`menu-item-icon-size  ${
                        openSubmenu?.type === menuType &&
                        openSubmenu?.index === index
                          ? 'menu-item-icon-active'
                          : 'menu-item-icon-inactive'
                      }`}
                    >
                      {nav.icon}
                    </span>
                    {(isExpanded || isHovered || isMobileOpen) && (
                      <span className="menu-item-text">{t(nav.tKey ?? nav.name)}</span>
                    )}
                    {(isExpanded || isHovered || isMobileOpen) && (
                      <ChevronDownIcon
                        className={`${dir === 'ltr' ? 'ml-auto' : 'mr-auto'} w-5 h-5 transition-transform duration-200 ${
                          openSubmenu?.type === menuType &&
                          openSubmenu?.index === index
                            ? 'rotate-180 text-brand-500'
                            : ''
                        }`}
                      />
                    )}
                  </button>
                  {(isExpanded || isHovered || isMobileOpen) && (
                    <div
                      ref={(el) => {
                        subMenuRefs.current[`${menuType}-${index}`] = el;
                      }}
                      className="overflow-hidden transition-all duration-300"
                      style={{
                        height:
                          openSubmenu?.type === menuType &&
                          openSubmenu?.index === index
                            ? `${subMenuHeight[`${menuType}-${index}`]}px`
                            : '0px',
                      }}
                    >
                      <ul className={`mt-2 space-y-1 ${dir === 'ltr' ? 'ml-9' : 'mr-9'}`}>
                        {visibleSubItems.map((subItem) => (
                          <li key={subItem.path}>
                            <Link
                              to={subItem.path}
                              className={`menu-dropdown-item ${
                                isActive(subItem.path)
                                  ? 'menu-dropdown-item-active'
                                  : 'menu-dropdown-item-inactive'
                              }`}
                            >
                              {hasSingleAssignedCompany &&
                              subItem.path === '/companies'
                                ? t('companyData')
                                : t(subItem.tKey ?? subItem.name)}
                              <span className={`flex items-center gap-1 ${dir === 'ltr' ? 'ml-auto' : 'mr-auto'}`}>
                                {subItem.new && (
                                  <span
                                    className={`${dir === 'ltr' ? 'ml-auto' : 'mr-auto'} ${
                                      isActive(subItem.path)
                                        ? 'menu-dropdown-badge-active'
                                        : 'menu-dropdown-badge-inactive'
                                    } menu-dropdown-badge`}
                                  >
                                    {t('new')}
                                  </span>
                                )}
                                {subItem.pro && (
                                  <span
                                    className={`${dir === 'ltr' ? 'ml-auto' : 'mr-auto'} ${
                                      isActive(subItem.path)
                                        ? 'menu-dropdown-badge-active'
                                        : 'menu-dropdown-badge-inactive'
                                    } menu-dropdown-badge`}
                                  >
                                    {t('pro')}
                                  </span>
                                )}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                nav.path && (
                  <Link
                    to={nav.path}
                    className={`menu-item group ${
                      isActive(nav.path)
                        ? 'menu-item-active'
                        : 'menu-item-inactive'
                    }`}
                  >
                    <span
                      className={`menu-item-icon-size ${
                        isActive(nav.path)
                          ? 'menu-item-icon-active'
                          : 'menu-item-icon-inactive'
                      }`}
                    >
                      {nav.icon}
                    </span>
                    {(isExpanded || isHovered || isMobileOpen) && (
                      <span className="menu-item-text">{t(nav.tKey ?? nav.name)}</span>
                    )}
                  </Link>
                )
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 pt-[env(safe-area-inset-top)] lg:pt-0 px-5 ${dir === 'ltr' ? 'left-0' : 'right-0'} bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 ${dir === 'ltr' ? 'border-r' : 'border-l'} border-gray-200
        ${
          isExpanded || isMobileOpen
            ? 'w-[290px]'
            : isHovered
              ? 'w-[290px]'
              : 'w-[90px]'
        }
        ${isMobileOpen ? 'translate-x-0' : dir === 'ltr' ? '-translate-x-full' : 'translate-x-full'}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 ${dir === 'ltr' ? 'ml-5' : 'mr-5'} flex ${
          !isExpanded && !isHovered ? 'lg:justify-center' : 'justify-start'
        }`}
      >
        <Link to="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <img
                className="dark:hidden"
                src="/images/logo/auth-logo.png"
                alt="Logo"
                width={200}
                height={30}
              />
              <img
                className="hidden dark:block"
                src="/images/logo/auth-logo.png"
                alt="Logo"
                width={200}
                height={30}
              />
            </>
          ) : (
            <img
              src="/images/logo/auth-logo.png"
              alt="Logo"
              width={200}
              height={30}
            />
          )}
        </Link>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? 'lg:justify-center'
                    : 'justify-start'
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? null : (
                  <HorizontaLDots className="size-6" />
                )}
              </h2>
              {renderMenuItems(navItems, 'main')}
            </div>
            {hasAdminPermissions && (
              <div className="">
                <h2
                  className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                    !isExpanded && !isHovered
                      ? 'lg:justify-center'
                      : 'justify-start'
                  }`}
                >
                  {isExpanded || isHovered || isMobileOpen ? null : (
                    <HorizontaLDots />
                  )}
                </h2>
                {renderMenuItems(adminItems, 'admin')}
              </div>
            )}
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
