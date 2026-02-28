import React, { useRef, useState } from 'react';
import { useHandTracking } from './hooks/useHandTracking';
import { VFXCanvas } from './components/VFXCanvas';
import { MODES } from './types';
import { 
  HandRaisedIcon, 
  SparklesIcon, 
  BoltIcon, 
  FireIcon, 
  CubeIcon,
  TrashIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon
} from '@heroicons/react/24/outline';

const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  
  // Only initialize tracking when the app has started and videoRef is rendered
  const { isReady, handDataRef, trackingType } = useHandTracking(videoRef, started);
  
  const [currentModeIdx, setCurrentModeIdx] = useState(0);
  const [stats, setStats] = useState("Initializing...");
  const [showUI, setShowUI] = useState(true);
  const [mirror, setMirror] = useState(true);
  const [triggerClear, setTriggerClear] = useState(false);

  const handleStart = () => {
    setStarted(true);
  };

  const currentMode = MODES[currentModeIdx];

  const doClear = () => {
      setTriggerClear(prev => !prev);
  };

  if (!started) {
    return (
      <div className="fixed inset-0 bg-black text-white flex items-center justify-center p-6 z-50 bg-[url('https://picsum.photos/1920/1080?grayscale&blur=5')] bg-cover bg-center">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
        <div className="relative max-w-2xl w-full bg-zinc-900/90 border border-zinc-700 p-8 rounded-2xl shadow-2xl ring-1 ring-white/10">
          <div className="flex items-center space-x-3 mb-4">
             <div className="w-2 h-12 bg-cyan-500 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.6)]"></div>
             <h1 className="text-4xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
               LIGHT WAND
             </h1>
          </div>
          <p className="text-zinc-400 text-lg mb-8 leading-relaxed">
            An interactive GPU particle simulation controlled by your hands using MediaPipe and Three.js. 
            Wave your hand to paint light, pinch to boost intensity, and hold an open palm to release a shockwave.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
             <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                <h3 className="text-cyan-400 font-mono text-sm mb-2 uppercase tracking-wider">Gestures</h3>
                <ul className="text-sm text-zinc-300 space-y-2">
                   <li className="flex items-center"><span className="w-1.5 h-1.5 bg-white rounded-full mr-2"></span>Index Finger: Paint Light</li>
                   <li className="flex items-center"><span className="w-1.5 h-1.5 bg-white rounded-full mr-2"></span>Pinch: Boost Energy</li>
                   <li className="flex items-center"><span className="w-1.5 h-1.5 bg-white rounded-full mr-2"></span>Open Palm (1s): Clear Canvas</li>
                </ul>
             </div>
             <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                <h3 className="text-purple-400 font-mono text-sm mb-2 uppercase tracking-wider">Tech Stack</h3>
                <p className="text-sm text-zinc-300">
                  Three.js WebGL 2.0 • MediaPipe Hands • React 18 • Custom GLSL Fluid Solvers
                </p>
             </div>
          </div>

          <button 
            onClick={handleStart}
            className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-900/20 flex items-center justify-center space-x-2 group"
          >
            <VideoCameraIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span>INITIALIZE SYSTEM</span>
          </button>
          <p className="text-center text-xs text-zinc-500 mt-4">Requires Camera Access • Desktop Recommended</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden font-sans select-none">
      {/* Hidden Video Feed for CV */}
      <video 
        ref={videoRef} 
        className="fixed top-0 left-0 w-1 opacity-0 pointer-events-none" 
        playsInline 
        muted 
      />

      {/* Loading Indicator */}
      {!isReady && (
        <div className="fixed inset-0 flex items-center justify-center z-40 bg-black">
           <div className="flex flex-col items-center space-y-4">
              <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
              <div className="text-cyan-500 font-mono text-sm animate-pulse">BOOTING VFX ENGINE...</div>
           </div>
        </div>
      )}

      {/* WebGL Canvas */}
      {isReady && (
        <VFXCanvas 
            handDataRef={handDataRef} 
            preset={currentMode}
            mirror={mirror}
            onStatsUpdate={setStats}
            triggerClear={triggerClear}
        />
      )}

      {/* HUD / UI Layer */}
      <div className={`fixed inset-0 pointer-events-none transition-opacity duration-500 ${showUI ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* Top Left: Status */}
        <div className="absolute top-6 left-6 pointer-events-auto">
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3 w-64 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
               <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest">System Status</span>
               <div className={`w-2 h-2 rounded-full ${isReady ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            </div>
            <div className="font-mono text-xs text-zinc-300 space-y-1">
               <div className="flex justify-between">
                  <span>Engine:</span> <span className="text-white">Active</span>
               </div>
               <div className="flex justify-between">
                  <span>Input:</span> 
                  <span className={trackingType === 'camera' ? "text-green-400" : "text-yellow-400"}>
                     {trackingType === 'camera' ? "CAMERA TRACKING" : "MOUSE FALLBACK"}
                  </span>
               </div>
               <div className="flex justify-between border-t border-white/10 pt-1 mt-1">
                  <span>Output:</span> <span className="text-white">{stats}</span>
               </div>
            </div>
          </div>
        </div>

        {/* Bottom Center: Mode Selector */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto">
          <div className="flex items-center space-x-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl">
            {MODES.map((mode, idx) => {
              const isActive = idx === currentModeIdx;
              const icons = [SparklesIcon, BoltIcon, HandRaisedIcon, FireIcon];
              const Icon = icons[idx] || CubeIcon;
              
              return (
                <button
                  key={mode.name}
                  onClick={() => setCurrentModeIdx(idx)}
                  className={`relative group px-4 py-3 rounded-xl transition-all duration-300 flex flex-col items-center min-w-[80px]
                    ${isActive 
                      ? 'bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.15)] ring-1 ring-white/20' 
                      : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'
                    }`}
                >
                  <Icon className={`w-6 h-6 mb-1 ${isActive ? 'text-cyan-400' : ''}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{mode.name.split(' ')[0]}</span>
                  {isActive && <div className="absolute bottom-1 w-1 h-1 bg-cyan-400 rounded-full"></div>}
                </button>
              );
            })}
            
            <div className="w-px h-10 bg-white/10 mx-2"></div>

            <button 
              onClick={doClear}
              className="p-3 rounded-xl text-red-400 hover:bg-red-500/20 hover:text-red-200 transition-colors"
              title="Clear Canvas"
            >
              <TrashIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Top Right: Settings */}
        <div className="absolute top-6 right-6 pointer-events-auto flex flex-col space-y-2">
           <button 
             onClick={() => setMirror(!mirror)}
             className={`p-3 rounded-full backdrop-blur-md border transition-all ${mirror ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' : 'bg-black/40 border-white/10 text-zinc-400'}`}
             title="Mirror Camera"
           >
             {mirror ? <VideoCameraIcon className="w-5 h-5" /> : <VideoCameraSlashIcon className="w-5 h-5" />}
           </button>
           
           <button 
             onClick={() => setShowUI(false)}
             className="p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
             title="Hide UI (Press ESC to show)"
           >
             <CubeIcon className="w-5 h-5" />
           </button>
        </div>

      </div>

      {/* Hidden 'Show UI' trigger area or Key handler hint */}
      {!showUI && (
        <button 
          onClick={() => setShowUI(true)}
          className="fixed top-6 right-6 p-3 bg-white/10 backdrop-blur-md rounded-full text-white/50 hover:text-white transition-all z-50"
        >
          <CubeIcon className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default App;