import { useState } from 'react';
import { LegalDocumentSheet } from '@/components/LegalDocumentSheet';

export const useLegalSheet = (onDocumentViewed?: (document: 'terms' | 'privacy') => void) => {
  const [open, setOpen] = useState(false);
  const [document, setDocument] = useState<'terms' | 'privacy'>('terms');

  const openTerms = () => {
    setDocument('terms');
    setOpen(true);
  };

  const openPrivacy = () => {
    setDocument('privacy');
    setOpen(true);
  };

  const handleDocumentViewed = () => {
    onDocumentViewed?.(document);
  };

  const LegalSheet = () => (
    <LegalDocumentSheet 
      open={open} 
      onOpenChange={setOpen} 
      document={document}
      onDocumentViewed={handleDocumentViewed}
    />
  );

  return { openTerms, openPrivacy, LegalSheet };
};
