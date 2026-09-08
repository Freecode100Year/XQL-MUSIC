import React, { useMemo, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { usePlayer } from '../src/hooks/usePlayer';
import { useEqualizer } from '../src/hooks/useEqualizer';
import { LocaleProvider } from '../src/i18n';
import { requestCache } from '../src/utils/cache';
import { DEFAULT_ADVANCED } from '../src/audio/settings';
const notify = () => {};
function Fixture() {
  const eq = useEqualizer();
  const bridge = useMemo(() => ({ filtersRef: eq.filtersRef, preampRef: eq.preampRef, createFilters: eq.createFilters, createPreamp: eq.createPreamp }), [eq.filtersRef,eq.preampRef,eq.createFilters,eq.createPreamp]);
  const p = usePlayer(notify, bridge);
  const [meter, setMeter] = useState('none');
  const [name, setName] = useState('Test signal');
  const url = useMemo(() => {
    const rate=16000, length=rate*60, data=new ArrayBuffer(44+length*4), view=new DataView(data);
    const text=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
    text(0,'RIFF');view.setUint32(4,36+length*4,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);
    view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,rate,true);view.setUint32(28,rate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,length*4,true);
    for(let i=0;i<length;i++){view.setInt16(44+i*4,Math.round(16*Math.sin(2*Math.PI*440*i/rate)),true);view.setInt16(46+i*4,Math.round(16*Math.sin(2*Math.PI*880*i/rate)),true);}
    return URL.createObjectURL(new Blob([data],{type:'audio/wav'}));
  }, []);
  useEffect(()=>{const timer=setInterval(()=>{const metrics=p.getAudioMetrics();setMeter(metrics?JSON.stringify({rms:metrics.rms.toFixed(2),peak:metrics.peak.toFixed(2),outputs:metrics.output.map(v=>v.toFixed(2))}):'native');},250);return()=>clearInterval(timer);},[p.getAudioMetrics]);
  const start=()=>{
    p.setAdvanced(DEFAULT_ADVANCED);eq.reset();eq.setEnabled(false);p.setGainMultiplier(1);p.setVolume(.2);p.setBalance(0);p.setCrossfeed('off');
    requestCache.set('song_url_standard_wy_fixture',url,600000);
    const song={id:'fixture',name,artist:'Local generated tone',source:'wy' as const,sourceType:'standard' as const};
    p.playSong(song,[song],0);
  };
  return <main><h1>Player integration check</h1>
    <button onClick={start}>Start quiet test signal</button><button onClick={()=>p.setProcessingEnabled(true)}>Enable effects</button><button onClick={()=>p.setProcessingEnabled(false)}>Native playback</button>
    <button onClick={p.toggleVirtual8d}>Toggle 8D</button><button onClick={p.toggleNightMode}>Toggle night</button><button onClick={()=>p.setGainMultiplier(0)}>Zero preamp</button><button onClick={()=>p.setGainMultiplier(1)}>Restore preamp</button>
    <button onClick={p.togglePlay}>Play / pause</button><button onClick={()=>{p.seek(10);}}>Seek to 10s</button>
    <p>Playing: {String(p.isPlaying)}</p><p>Effects: {String(p.processingEnabled)}</p><p>Time: {p.currentTime.toFixed(2)}</p><p>Track: {p.currentSong?.name}</p><p>Meter: {meter}</p>
  </main>;
}
createRoot(document.getElementById('root')!).render(<LocaleProvider><Fixture/></LocaleProvider>);
