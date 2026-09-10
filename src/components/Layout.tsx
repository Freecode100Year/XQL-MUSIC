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
  virtual8dSpeed: number;
  virtual8dDepth: number;
  onSetVolume: (value: number) => void;
  onSetGainMultiplier: (value: number) => void;
  onCycleCrossfeed: () => void;
  onToggleOutput: () => void;
  onShowEqualizer: () => void;
  onShowAudioStudio: () => void;
  processingEnabled: boolean;
  onToggleMono: () => void;
  onSetBalance: (value: number) => void;
  onToggleNightMode: () => void;
  onToggleVirtual8d: () => void;
  onSetVirtual8dSpeed: (value: number) => void;
  onSetVirtual8dDepth: (value: number) => void;
  username: string | null;
  onOpenFavorites: () => void;
  onOpenRegistration: () => void;
}

export function Layout({
  currentPage, setPage, children, onSearchFocus, volume, gainMultiplier,
  crossfeedMode, outputMode, eqEnabled, onSetVolume, onSetGainMultiplier,
  onCycleCrossfeed, onToggleOutput, onShowEqualizer, spatialMode, nightMode,
  balance, onToggleMono, onSetBalance, onToggleNightMode,
  virtual8d, onToggleVirtual8d,
  virtual8dSpeed, virtual8dDepth, onSetVirtual8dSpeed, onSetVirtual8dDepth,
  onShowAudioStudio, processingEnabled,
  username, onOpenFavorites, onOpenRegistration,
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
        virtual8dSpeed={virtual8dSpeed}
        virtual8dDepth={virtual8dDepth}
        onSetVolume={onSetVolume}
        onSetGainMultiplier={onSetGainMultiplier}
        onCycleCrossfeed={onCycleCrossfeed}
        onToggleOutput={onToggleOutput}
        onShowEqualizer={onShowEqualizer}
        onShowAudioStudio={onShowAudioStudio}
        processingEnabled={processingEnabled}
        onToggleMono={onToggleMono}
        onSetBalance={onSetBalance}
        onToggleNightMode={onToggleNightMode}
        onToggleVirtual8d={onToggleVirtual8d}
        onSetVirtual8dSpeed={onSetVirtual8dSpeed}
        onSetVirtual8dDepth={onSetVirtual8dDepth}
        username={username}
        onOpenFavorites={onOpenFavorites}
        onOpenRegistration={onOpenRegistration}
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
