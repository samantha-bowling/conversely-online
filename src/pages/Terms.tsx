import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LegalLayout } from '@/components/LegalLayout';

const Terms = () => {
  const [content, setContent] = useState('');

  useEffect(() => {
    // Import the markdown file
    fetch('/legal/terms.md')
      .then((res) => res.text())
      .then((text) => setContent(text))
      .catch(() => setContent('# Terms of Service\n\nUnable to load terms. Please contact hello@conversely.online'));
  }, []);

  return (
    <LegalLayout title="Terms of Service" lastUpdated="October 6, 2025">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </LegalLayout>
  );
};

export default Terms;
