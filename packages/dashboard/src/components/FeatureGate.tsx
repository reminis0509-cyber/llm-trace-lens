import { ReactNode } from 'react';
import { Lock } from 'lucide-react';

interface FeatureGateProps {
  locked: boolean;
  title: string;
  description?: string;
  children: ReactNode;
}

export function FeatureGate({ locked, title, description, children }: FeatureGateProps) {
  return (
    <div className="relative">
      {children}
      {locked && (
        <div className="absolute inset-0 z-10 rounded-lg flex flex-col items-center justify-center backdrop-blur-sm bg-base/60">
          <Lock className="w-5 h-5 text-text-muted mb-2" strokeWidth={1.5} />
          <p className="text-sm text-text-primary font-medium">{title}</p>
          {description && (
            <p className="text-xs text-text-muted mt-1 text-center px-4">{description}</p>
          )}
          <button
            onClick={() => {
              const settingsTab = document.querySelector('[data-tab="settings"]') as HTMLElement;
              if (settingsTab) settingsTab.click();
            }}
            className="mt-3 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition"
          >
            Pro\u30D7\u30E9\u30F3\u306B\u30A2\u30C3\u30D7\u30B0\u30EC\u30FC\u30C9
          </button>
        </div>
      )}
    </div>
  );
}
