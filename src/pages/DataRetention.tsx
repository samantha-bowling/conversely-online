import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LegalLayout } from '@/components/LegalLayout';

const DataRetention = () => {
  const [content, setContent] = useState('');

  useEffect(() => {
    fetch('/legal/data-retention.md')
      .then((res) => res.text())
      .then((text) => setContent(text))
      .catch(() => setContent('# Data Retention Policy\n\nUnable to load data retention policy. Please contact hello@conversely.online'));
  }, []);

  return (
    <LegalLayout title="Data Retention Policy" lastUpdated="October 14, 2025">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </LegalLayout>
  );
};

export default DataRetention;
