import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface LegalDocumentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: 'terms' | 'privacy' | 'data-retention';
  onDocumentViewed?: () => void;
}

const DOCUMENT_CONFIG = {
  terms: {
    title: 'Terms of Service',
    path: '/legal/terms.md',
    lastUpdated: 'October 6, 2025',
  },
  privacy: {
    title: 'Privacy Policy',
    path: '/legal/privacy.md',
    lastUpdated: 'October 6, 2025',
  },
  'data-retention': {
    title: 'Data Retention Policy',
    path: '/legal/data-retention.md',
    lastUpdated: 'October 14, 2025',
  },
};

export const LegalDocumentSheet = ({ open, onOpenChange, document, onDocumentViewed }: LegalDocumentSheetProps) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const config = DOCUMENT_CONFIG[document];

  useEffect(() => {
    if (open) {
      setLoading(true);
      setError(false);
      
      // Notify parent that document is being viewed
      onDocumentViewed?.();
      
      fetch(config.path)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load document');
          return res.text();
        })
        .then((text) => {
          setContent(text);
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
        });
    }
  }, [open, config.path, onDocumentViewed]);

  const handleRetry = () => {
    setError(false);
    setLoading(true);
    
    fetch(config.path)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load document');
        return res.text();
      })
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="sticky top-0 bg-background pb-4 border-b border-border mb-6">
          <SheetTitle>{config.title}</SheetTitle>
          <SheetDescription>Last Updated: {config.lastUpdated}</SheetDescription>
        </SheetHeader>

        <div className="pb-6">
          {loading && (
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-8 w-2/3 mt-8" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          )}

          {error && (
            <div className="text-center py-12 space-y-4">
              <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Unable to Load Document</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  There was a problem loading this document. Please try again.
                </p>
                <Button onClick={handleRetry} variant="outline">
                  Retry
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-8">
                If the problem persists, contact{' '}
                <a href="mailto:hello@conversely.online" className="text-primary hover:underline">
                  hello@conversely.online
                </a>
              </p>
            </div>
          )}

          {!loading && !error && (
            <article className="prose prose-slate dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </article>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
