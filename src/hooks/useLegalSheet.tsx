import { useState } from 'react';
import { LegalDocumentSheet } from '@/components/LegalDocumentSheet';

export const useLegalSheet = () => {
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

  const LegalSheet = () => (
    <LegalDocumentSheet 
      open={open} 
      onOpenChange={setOpen} 
      document={document} 
    />
  );

  return { openTerms, openPrivacy, LegalSheet };
};
