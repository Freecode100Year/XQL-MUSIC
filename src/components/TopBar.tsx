import React from 'react';
import { Page } from '../types';
import { useI18n } from '../i18n';
import { REPOSITORY_URL } from '../config';

interface TopBarProps {
  currentPage: Page;
  onMenuClick: () => void;
  onSearchFocus: () => void;
}

export function TopBar({ currentPage, onMenuClick, onSearchFocus }: TopBarProps) {
  const { t } = useI18n();
  const titles: Record<Page, string> = {
    home: t('nav.home'),
    search: t('nav.search'),
    favorites: t('nav.favorites'),
  };

  return (
    <header className="topbar">
      <button className="topbar-menu" onClick={onMenuClick}>
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
        </svg>
      </button>
      <h1 className="topbar-title">{titles[currentPage]}</h1>
      <a
        className="topbar-repository"
        href={REPOSITORY_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('repository.open')}
        title={t('repository.open')}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
          <path d="M12 .7a11.5 11.5 0 00-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.04 1.77 2.72 1.26 3.38.96.1-.75.4-1.26.74-1.55-2.57-.29-5.27-1.28-5.27-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18a10.94 10.94 0 015.75 0c2.19-1.49 3.15-1.18 3.15-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.71 5.38-5.29 5.67.42.36.79 1.07.79 2.16v3.2c0 .31.21.67.8.56A11.5 11.5 0 0012 .7z" />
        </svg>
        <span>XQL-MUSIC</span>
      </a>
      <button className="topbar-search" onClick={onSearchFocus}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        </svg>
      </button>
    </header>
  );
}
