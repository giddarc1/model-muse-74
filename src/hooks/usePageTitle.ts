import { useEffect } from 'react';

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `RapidMCT — ${title}` : 'RapidMCT';
    return () => { document.title = 'RapidMCT'; };
  }, [title]);
}
