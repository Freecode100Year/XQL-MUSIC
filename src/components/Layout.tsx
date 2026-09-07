import React, { useState } from 'react';
import { Page } from '../types';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CrossfeedMode, OutputMode, SpatialMode } from '../utils/storage';

interface LayoutProps {
  currentPage: Page;
  setPage: (page: Page) => void;
  children: React.ReactNode;
  onSearchFocus: () => void;
  volume: number;
  gainMultiplier: number;
  crossfeedMode: CrossfeedMode;
  outputMode: OutputMode;
  eqEnabled: boolean;
  spatialMode: SpatialMode;
  nightMode: boolean;
  balance: number;
  virtual8d: boolean;
  onSetVolume: (value: number) => void;
  onSetGainMultiplier: (value: number) => void;
  onCycleCrossfeed: () => void;
  onToggleOutput: () => void;
  onShowEqualizer: () => void;
  onToggleStereoWide: () => void;
  onToggleMono: () => void;
  onSetBalance: (value: number) => void;
  onToggleNightMode: () => void;
  onToggleVirtual8d: () => void;
}

export function Layout({
  currentPage, setPage, children, onSearchFocus, volume, gainMultiplier,
  crossfeedMode, outputMode, eqEnabled, onSetVolume, onSetGainMultiplier,
  onCycleCrossfeed, onToggleOutput, onShowEqualizer, spatialMode, nightMode,
  balance, onToggleStereoWide, onToggleMono, onSetBalance, onToggleNightMode,
  virtual8d, onToggleVirtual8d,
}: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar
        currentPage={currentPage}
        setPage={setPage}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        volume={volume}
        gainMultiplier={gainMultiplier}
        crossfeedMode={crossfeedMode}
        outputMode={outputMode}
        eqEnabled={eqEnabled}
        spatialMode={spatialMode}
        nightMode={nightMode}
        balance={balance}
        virtual8d={virtual8d}
        onSetVolume={onSetVolume}
        onSetGainMultiplier={onSetGainMultiplier}
        onCycleCrossfeed={onCycleCrossfeed}
        onToggleOutput={onToggleOutput}
        onShowEqualizer={onShowEqualizer}
        onToggleStereoWide={onToggleStereoWide}
        onToggleMono={onToggleMono}
        onSetBalance={onSetBalance}
        onToggleNightMode={onToggleNightMode}
        onToggleVirtual8d={onToggleVirtual8d}
      />
      <main className="main-content">
        <TopBar
          currentPage={currentPage}
          onMenuClick={() => setMobileOpen(true)}
          onSearchFocus={onSearchFocus}
        />
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}
