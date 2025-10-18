import { useState } from 'react';

export const useLegalSheet = () => {
  const [open, setOpen] = useState(false);
  const [document, setDocument] = useState<'terms' | 'privacy' | 'data-retention'>('terms');

  const openTerms = () => {
    setDocument('terms');
    setOpen(true);
  };

  const openPrivacy = () => {
    setDocument('privacy');
    setOpen(true);
  };

  const openDataRetention = () => {
    setDocument('data-retention');
    setOpen(true);
  };

  return { open, document, openTerms, openPrivacy, openDataRetention, setOpen };
};
