// components/Navbar.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n/hooks/useTranslation';
import LanguageSwitcher from '../i18n/components/LanguageSwitcher';
import { useNavigate, useLocation, Link } from 'react-router';
import { tokenStorage } from '../../../config/api';

const Navbar = () => {
  const { t, isArabic } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeLink, setActiveLink] = useState('home');
  const navigate = useNavigate();
  const location = useLocation();

  const navLinks = [
    { id: 'home', label: t('navigation:home') || 'Home', href: '/' },
    {
      id: 'services',
      label: t('navigation:services'),
      href: '/services',
    },
    { id: 'about', label: t('navigation:about'), href: '/about' },
    {
      id: 'contact',
      label: t('navigation:contact'),
      href: '/contact',
    },
  ];

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Track route changes and update active link accordingly
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/services')) setActiveLink('services');
    else if (path.startsWith('/about')) setActiveLink('about');
    else if (path.startsWith('/contact')) setActiveLink('contact');
    else setActiveLink('home');
  }, [location.pathname]);

  const scrollToSection = (href) => {
    setIsOpen(false);
    if (href && href.startsWith('/')) {
      navigate(href);
      return;
    }
    if (href === '#') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveLink(href.replace('#', ''));
    }
  };

  const handleLogin = () => {
    const token = tokenStorage.getAccessToken();
    if (token) {
      navigate('/home');
    } else {
      navigate('/signin');
    }
  };

  // Icon map for mobile menu
  const getIcon = (id) => {
    switch (id) {
      case 'home':
        return (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        );
      case 'services':
        return (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        );
      case 'about':
        return (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        );
      case 'contact':
        return (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        );
      default:
        return null;
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top)] transition-all duration-500 ${
        isScrolled
          ? 'bg-white/90 dark:bg-dark-900/90 backdrop-blur-xl shadow-lg py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            onClick={() => setActiveLink('home')}
            className="relative group"
          >
            <div className="absolute -inset-2 bg-linear-to-r from-primary-500 to-secondary-500 rounded-lg opacity-0" />
            <div className="relative">
              <img src="/images/logo/auth-logo.png" alt="Logo" className="h-10 w-auto" />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.id}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(link.href);
                }}
                className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 group ${
                  activeLink === link.id
                    ? 'text-primary-500'
                    : 'text-light-700 dark:text-light-300 hover:text-primary-500'
                }`}
              >
                <span className="relative z-10">{link.label}</span>
                {activeLink === link.id && (
                  <span className="absolute inset-0 bg-primary-500/10 rounded-lg animate-fade-in" />
                )}
                <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-0 h-0.5 bg-linear-to-r from-primary-500 to-secondary-500 group-hover:w-full transition-all duration-300" />
              </a>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-4">
            {/* Login Button */}
            <button
              onClick={handleLogin}
              className="hidden lg:inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-all duration-300 cursor-pointer"
            >
              {t('navigation:login')}
            </button>

            {/* Language Switcher */}
            <LanguageSwitcher className="hidden lg:block" />

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden relative w-10 h-10 rounded-xl bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm border border-light-200/50 dark:border-dark-700/50 flex flex-col items-center justify-center gap-1.5 hover:border-primary-500/50 transition-all duration-300 group"
              aria-label="Toggle menu"
            >
              <span
                className={`w-5 h-0.5 bg-light-700 dark:bg-light-300 rounded-full transition-all duration-300 ${isOpen ? 'rotate-45 translate-y-2' : ''}`}
              />
              <span
                className={`w-5 h-0.5 bg-light-700 dark:bg-light-300 rounded-full transition-all duration-300 ${isOpen ? 'opacity-0' : 'opacity-100'}`}
              />
              <span
                className={`w-5 h-0.5 bg-light-700 dark:bg-light-300 rounded-full transition-all duration-300 ${isOpen ? '-rotate-45 -translate-y-2' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <div
          className={`lg:hidden absolute left-0 right-0 top-full mt-2 mx-4 transition-all duration-500 transform ${
            isOpen
              ? 'opacity-100 translate-y-0 visible'
              : 'opacity-0 -translate-y-4 invisible'
          }`}
        >
          <div className="bg-white/95 dark:bg-dark-900/95 backdrop-blur-xl rounded-2xl border border-light-200/50 dark:border-dark-700/50 shadow-2xl overflow-hidden">
            <div className="p-4 space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection(link.href);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
                    activeLink === link.id
                      ? 'bg-linear-to-r from-primary-500/10 to-secondary-500/10 text-primary-500'
                      : 'text-light-700 dark:text-light-300 hover:bg-light-100 dark:hover:bg-dark-800'
                  }`}
                >
                  <span className="w-5 h-5 shrink-0">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {getIcon(link.id)}
                    </svg>
                  </span>
                  <span className="flex-1 font-medium">{link.label}</span>
                  {activeLink === link.id && (
                    <span className="w-5 h-5 text-primary-500">
                      <svg
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </span>
                  )}
                </a>
              ))}
            </div>

            {/* Mobile bottom — Login + Language Switcher */}
            <div className="p-4 border-t border-light-200 dark:border-dark-700 bg-light-50/50 dark:bg-dark-800/50 space-y-2">
              <button
                onClick={() => {
                  setIsOpen(false);
                  handleLogin();
                }}
                className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-all duration-300 w-full cursor-pointer"
              >
                {t('navigation:login')}
              </button>
              <LanguageSwitcher className="w-full justify-center" />
            </div>
          </div>
        </div>

        {/* Scroll Progress Bar */}
        <div
          className={`absolute bottom-0 left-0 h-0.5 bg-linear-to-r from-primary-500 to-secondary-500 transition-all duration-300 ${
            isScrolled ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            width: `${Math.min(
              (window.scrollY /
                (document.documentElement.scrollHeight - window.innerHeight)) *
                100,
              100
            )}%`,
          }}
        />
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </nav>
  );
};

export default Navbar;
