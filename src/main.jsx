import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import CloudApp from './CloudApp.jsx';
import './style.css';
import './cloud.css';
function Root(){const [theme,setTheme]=useState(()=>{try{return localStorage.getItem('daily-fuel-theme')==='dark'?'dark':'light'}catch{return 'light'}});useEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;try{localStorage.setItem('daily-fuel-theme',theme)}catch{}},[theme]);const toggleTheme=()=>setTheme(t=>t==='dark'?'light':'dark');const [mode,setMode]=useState(()=>localStorage.getItem('daily-fuel-mode')||'cloud');function change(mode){localStorage.setItem('daily-fuel-mode',mode);setMode(mode)}return mode==='cloud'?<CloudApp onLocal={()=>change('local')} theme={theme} onToggleTheme={toggleTheme}/>:<><div className="offline-switch"><button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme==='dark'?'light':'dark'} mode`}>{theme==='dark'?'☀ Light mode':'☾ Dark mode'}</button><button onClick={()=>change('cloud')}>☁ Family cloud & accounts ↗</button></div><App/></>}
createRoot(document.getElementById('root')).render(<React.StrictMode><Root/></React.StrictMode>);

// Register the service worker only on deployed production builds.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => console.warn('PWA registration failed:', error));
  });
}
