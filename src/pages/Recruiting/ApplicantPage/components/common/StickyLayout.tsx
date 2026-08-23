import React from 'react';

export const getAllScrollParents = (el: HTMLElement | null): Array<HTMLElement | Window> => {
  const parents: Array<HTMLElement | Window> = [];
  let current = el?.parentElement ?? null;
  while (current) {
    const { overflowY } = getComputedStyle(current);
    if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight) {
      parents.push(current);
    }
    current = current.parentElement;
  }
  parents.push(window);
  return parents;
};

export const StickyTopBar: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const placeholderRef = React.useRef<HTMLDivElement>(null);
  const barRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const placeholder = placeholderRef.current;
    const bar = barRef.current;
    if (!placeholder || !bar) return;

    const getTopOffset = (): number => {
      const header =
        (document.querySelector('header') as HTMLElement | null) ??
        (document.querySelector('[class*="AppHeader"]') as HTMLElement | null) ??
        (document.querySelector('[class*="header"]') as HTMLElement | null) ??
        (document.querySelector('nav') as HTMLElement | null);
      const h = header ? header.getBoundingClientRect().bottom : 0;
      return Math.max(h, 0);
    };

    const resetPosition = () => {
      bar.style.position = '';
      bar.style.top = '';
      bar.style.left = '';
      bar.style.width = '';
      bar.style.zIndex = '';
      bar.style.paddingTop = '';
      bar.style.paddingBottom = '';
      placeholder.style.minHeight = '';
    };

    const update = () => {
      if (window.innerWidth < 1024) {
        resetPosition();
        return;
      }
      if (placeholder.offsetParent === null) return;

      const TOP_OFFSET = getTopOffset();
      const rect = placeholder.getBoundingClientRect();
      if (rect.top <= TOP_OFFSET) {
        const width = placeholder.offsetWidth;
        const left = rect.left;
        bar.style.position = 'fixed';
        bar.style.top = `${TOP_OFFSET}px`;
        bar.style.left = `${left}px`;
        bar.style.width = `${width}px`;
        bar.style.zIndex = '40';
        bar.style.paddingTop = '20px';
        placeholder.style.minHeight = `${bar.scrollHeight}px`;
      } else {
        resetPosition();
      }
    };

    const scrollParents = getAllScrollParents(placeholder);
    scrollParents.forEach(p => p.addEventListener('scroll', update, { passive: true }));
    window.addEventListener('resize', update, { passive: true });

    const ro = new ResizeObserver(update);
    ro.observe(placeholder);

    update();

    return () => {
      scrollParents.forEach(p => p.removeEventListener('scroll', update));
      window.removeEventListener('resize', update);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={placeholderRef}>
      <div ref={barRef} className="bg-gray-50/95 backdrop-blur-sm">
        {children}
      </div>
    </div>
  );
};

export const Stickysidebar: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const placeholderRef = React.useRef<HTMLDivElement>(null);
  const sidebarRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const placeholder = placeholderRef.current;
    const sidebar = sidebarRef.current;
    if (!placeholder || !sidebar) return;

    const getTopOffset = (): number => {
      const header =
        (document.querySelector('header') as HTMLElement | null) ??
        (document.querySelector('[class*="AppHeader"]') as HTMLElement | null) ??
        (document.querySelector('[class*="header"]') as HTMLElement | null) ??
        (document.querySelector('nav') as HTMLElement | null);
      const h = header ? header.getBoundingClientRect().bottom : 0;
      const topBarEl = document.querySelector('[class*="backdrop-blur"]') as HTMLElement | null;
      const topBarH = topBarEl ? topBarEl.getBoundingClientRect().height : 0;
      return Math.max(h + topBarH, 0);
    };

    const resetPosition = () => {
      sidebar.style.position = '';
      sidebar.style.top = '';
      sidebar.style.left = '';
      sidebar.style.width = '';
      sidebar.style.maxHeight = '';
      sidebar.style.overflowY = '';
      sidebar.style.zIndex = '';
      placeholder.style.minHeight = '';
    };

    const update = () => {
      if (window.innerWidth < 1024) {
        resetPosition();
        return;
      }
      if (placeholder.offsetParent === null) return;

      const TOP_OFFSET = getTopOffset();
      const rect = placeholder.getBoundingClientRect();
      const sidebarHeight = sidebar.scrollHeight;
      const windowHeight = window.innerHeight;

      if (rect.top <= TOP_OFFSET) {
        const width = placeholder.offsetWidth;
        const left = rect.left;
        const availableHeight = windowHeight - TOP_OFFSET - 24;
        sidebar.style.position = 'fixed';
        sidebar.style.top = `${TOP_OFFSET + 24}px`;
        sidebar.style.left = `${left}px`;
        sidebar.style.width = `${width}px`;
        if (sidebarHeight > availableHeight) {
          sidebar.style.maxHeight = `${availableHeight}px`;
          sidebar.style.overflowY = 'auto';
        }
        sidebar.style.zIndex = '20';
        placeholder.style.minHeight = `${sidebarHeight}px`;
      } else {
        resetPosition();
      }
    };

    let pageAtBottom = false;
    const onPageScroll = () => {
      pageAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 5;
    };
    window.addEventListener('scroll', onPageScroll, { passive: true });

    const handleWheel = (e: WheelEvent) => {
      if (window.innerWidth < 1024 || sidebar.style.position !== 'fixed') return;
      if (sidebar.scrollHeight <= sidebar.clientHeight) return;
      if (e.deltaY > 0 && pageAtBottom) {
        e.preventDefault();
        sidebar.scrollTop += 40;
      }
    };

    const scrollParents = getAllScrollParents(placeholder);
    scrollParents.forEach(p => p.addEventListener('scroll', update, { passive: true }));
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('scroll', onPageScroll, { passive: true });
    window.addEventListener('wheel', handleWheel, { passive: false });

    const ro = new ResizeObserver(update);
    ro.observe(placeholder);

    update();

    return () => {
      scrollParents.forEach(p => p.removeEventListener('scroll', update));
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', onPageScroll);
      window.removeEventListener('wheel', handleWheel);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={placeholderRef} className="lg:w-72 xl:w-80 flex-shrink-0 max-lg:self-stretch self-start">
      <div ref={sidebarRef} className="space-y-4 w-full pb-4">
        {children}
      </div>
    </div>
  );
};
