import { useEffect } from 'react';

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `Trooba Flow — ${title}` : 'Trooba Flow';
    return () => { document.title = 'Trooba Flow'; };
  }, [title]);
}
