import {initializeNative} from './lib/platform/native';
import React from 'react';
import {createRoot} from 'react-dom/client';
import CollectionApp from './components/collection/CollectionApp';
import './app/globals.css';
initializeNative();
createRoot(document.getElementById('root')!).render(<React.StrictMode><CollectionApp/></React.StrictMode>);
