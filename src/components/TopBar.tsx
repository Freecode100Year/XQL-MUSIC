import React from 'react';
import { Page } from '../types';
import { useI18n } from '../i18n';

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
      <button className="topbar-search" onClick={onSearchFocus}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        </svg>
      </button>
    </header>
  );
}
