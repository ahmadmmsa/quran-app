import React, { createContext, useContext, useState, useEffect } from 'react';

const ReaderContext = createContext();

export function ReaderProvider({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [fontSize, setFontSize] = useState(() => {
    return parseInt(localStorage.getItem('quran-font-size') || '28');
  });

  useEffect(() => {
    localStorage.setItem('quran-font-size', fontSize);
    document.documentElement.style.setProperty('--reader-font-size', `${fontSize}px`);
  }, [fontSize]);

  return (
    <ReaderContext.Provider
      value={{
        sidebarOpen,
        setSidebarOpen,
        searchQuery,
        setSearchQuery,
        fontSize,
        setFontSize,
      }}
    >
      {children}
    </ReaderContext.Provider>
  );
}

export function useReader() {
  return useContext(ReaderContext);
}
