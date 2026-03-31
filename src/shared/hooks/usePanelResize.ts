import { useEffect, useState } from 'react';
import { SIDEBAR_WIDTH_STORAGE_KEY } from '../lib/constants';

export function usePanelResize(initialWidth = 360) {
  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === 'undefined') {
      return initialWidth;
    }

    const savedWidth = Number(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));

    return Number.isFinite(savedWidth) && savedWidth > 0 ? savedWidth : initialWidth;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(panelWidth));
  }, [panelWidth]);

  return {
    panelWidth,
    setPanelWidth,
  };
}
