import { useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';

export default function PlaceholderPage() {
  const location = useLocation();
  const segment = location.pathname.split('/').pop() || '';
  const title = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground animate-fade-in">
      <Construction className="h-12 w-12 mb-4 opacity-30" />
      <h2 className="text-xl font-semibold mb-1">{title}</h2>
      <p className="text-sm">This module will be built in a future iteration.</p>
    </div>
  );
}
