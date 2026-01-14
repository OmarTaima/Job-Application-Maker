import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

// Assume these icons are imported from an icon library
import { ChevronDownIcon, GridIcon, HorizontaLDots, TaskIcon } from "../icons";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../context/AuthContext";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    subItems: [{ name: "Home", path: "/", pro: false }],
  },
  {
    icon: <TaskIcon />,
    name: "Recruiting",
    subItems: [
      { name: "Applicants", path: "/applicants", pro: false },
      { name: "Create Company", path: "/recruiting", pro: false },
      { name: "Companies", path: "/companies", pro: false },
      { name: "Create Job", path: "/create-job", pro: false },
      { name: "Jobs", path: "/jobs", pro: false },
    ],
  },
  // {
  //   icon: <CalenderIcon />,
  //   name: "Calendar",
  //   path: "/calendar",
  // },
  // {
  //   icon: <UserCircleIcon />,
  //   name: "User Profile",
  //   path: "/profile",
  // },
  // {
  //   name: "Forms",
  //   icon: <ListIcon />,
  //   subItems: [{ name: "Form Elements", path: "/form-elements", pro: false }],
  // },
  // {
  //   name: "Tables",
  //   icon: <TableIcon />,
  //   subItems: [{ name: "Basic Tables", path: "/basic-tables", pro: false }],
  // },
  // {
  //   name: "Pages",
  //   icon: <PageIcon />,
  //   subItems: [
  //     { name: "Blank Page", path: "/blank", pro: false },
  //     { name: "404 Error", path: "/error-404", pro: false },
  //   ],
  // },
];

const adminItems: NavItem[] = [
  {
    icon: <TaskIcon />,
    name: "User Management",
    subItems: [
      { name: "Users", path: "/users", pro: false },
      { name: "Permissions & Roles", path: "/permissions", pro: false },
      { name: "Recommended Fields", path: "/recommended-fields", pro: false },
    ],
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { hasPermission } = useAuth();
  const location = useLocation();

  // Check if user has read access to admin features
  const hasUserManagementRead = hasPermission("User Management", "read");
  const hasRoleManagementRead = hasPermission("Role Management", "read");
  const hasSettingsManagementRead = hasPermission("Settings Management", "read");
  
  // Show admin section if user has read access to any admin feature
  const hasAdminPermissions = hasUserManagementRead || hasRoleManagementRead || hasSettingsManagementRead;

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "admin";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // const isActive = (path: string) => location.pathname === path;
  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname]
  );

  useEffect(() => {
    let submenuMatched = false;
    ["main", "admin"].forEach((menuType) => {
      const items = menuType === "main" ? navItems : adminItems;
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (isActive(subItem.path)) {
              setOpenSubmenu({
                type: menuType as "main" | "admin",
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
  }, [location, isActive]);

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

  const handleSubmenuToggle = (index: number, menuType: "main" | "admin") => {
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

  const renderMenuItems = (items: NavItem[], menuType: "main" | "admin") => {
    // Filter menu items based on permissions
    const filterSubItems = (subItems: { name: string; path: string; pro?: boolean; new?: boolean }[]) => {
      return subItems.filter((subItem) => {
        // Map menu items to their required permissions
        if (subItem.path === "/applicants") return hasPermission("Applicant Management", "read");
        if (subItem.path === "/recruiting") return hasPermission("Company Management", "create");
        if (subItem.path === "/companies") return hasPermission("Company Management", "read");
        if (subItem.path === "/create-job") return hasPermission("Job Position Management", "create");
        if (subItem.path === "/jobs") return hasPermission("Job Position Management", "read");
        if (subItem.path === "/users") return hasPermission("User Management", "read");
        if (subItem.path === "/permissions") return hasPermission("Role Management", "read");
        if (subItem.path === "/recommended-fields") return hasPermission("Settings Management", "read");
        // Default: allow access (for dashboard, etc.)
        return true;
      });
    };

    return (
      <ul className="flex flex-col gap-4">
        {items.map((nav, index) => {
          // Filter sub-items if they exist
          const visibleSubItems = nav.subItems ? filterSubItems(nav.subItems) : undefined;
          
          // Don't render if no visible sub-items and it's a submenu
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
                      openSubmenu?.type === menuType && openSubmenu?.index === index
                        ? "menu-item-active"
                        : "menu-item-inactive"
                    } cursor-pointer ${
                      !isExpanded && !isHovered
                        ? "lg:justify-center"
                        : "lg:justify-start"
                    }`}
                  >
                    <span
                      className={`menu-item-icon-size  ${
                        openSubmenu?.type === menuType && openSubmenu?.index === index
                          ? "menu-item-icon-active"
                          : "menu-item-icon-inactive"
                      }`}
                    >
                      {nav.icon}
                    </span>
                    {(isExpanded || isHovered || isMobileOpen) && (
                      <span className="menu-item-text">{nav.name}</span>
                    )}
                    {(isExpanded || isHovered || isMobileOpen) && (
                      <ChevronDownIcon
                        className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                          openSubmenu?.type === menuType &&
                          openSubmenu?.index === index
                            ? "rotate-180 text-brand-500"
                            : ""
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
                          openSubmenu?.type === menuType && openSubmenu?.index === index
                            ? `${subMenuHeight[`${menuType}-${index}`]}px`
                            : "0px",
                      }}
                    >
                      <ul className="mt-2 space-y-1 ml-9">
                        {visibleSubItems.map((subItem) => (
                          <li key={subItem.name}>
                            <Link
                              to={subItem.path}
                              className={`menu-dropdown-item ${
                                isActive(subItem.path)
                                  ? "menu-dropdown-item-active"
                                  : "menu-dropdown-item-inactive"
                              }`}
                            >
                              {subItem.name}
                              <span className="flex items-center gap-1 ml-auto">
                                {subItem.new && (
                                  <span
                                    className={`ml-auto ${
                                      isActive(subItem.path)
                                        ? "menu-dropdown-badge-active"
                                        : "menu-dropdown-badge-inactive"
                                    } menu-dropdown-badge`}
                                  >
                                    new
                                  </span>
                                )}
                                {subItem.pro && (
                                  <span
                                    className={`ml-auto ${
                                      isActive(subItem.path)
                                        ? "menu-dropdown-badge-active"
                                        : "menu-dropdown-badge-inactive"
                                    } menu-dropdown-badge`}
                                  >
                                    pro
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
                      isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                    }`}
                  >
                    <span
                      className={`menu-item-icon-size ${
                        isActive(nav.path)
                          ? "menu-item-icon-active"
                          : "menu-item-icon-inactive"
                      }`}
                    >
                      {nav.icon}
                    </span>
                    {(isExpanded || isHovered || isMobileOpen) && (
                      <span className="menu-item-text">{nav.name}</span>
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
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link to="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <img
                className="dark:hidden"
                src="/images/logo/logo.svg"
                alt="Logo"
                width={50}
                height={32}
              />
              <img
                className="hidden dark:block"
                src="/images/logo/logo-dark.svg"
                alt="Logo"
                width={50}
                height={32}
              />
            </>
          ) : (
            <img
              src="/images/logo/logo-icon.svg"
              alt="Logo"
              width={28}
              height={28}
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
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <HorizontaLDots className="size-6" />
                )}
              </h2>
              {renderMenuItems(navItems, "main")}
            </div>
            {hasAdminPermissions && (
              <div className="">
                <h2
                  className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                    !isExpanded && !isHovered
                      ? "lg:justify-center"
                      : "justify-start"
                  }`}
                >
                  {isExpanded || isHovered || isMobileOpen ? (
                    "admin"
                  ) : (
                    <HorizontaLDots />
                  )}
                </h2>
                {renderMenuItems(adminItems, "admin")}
              </div>
            )}
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
