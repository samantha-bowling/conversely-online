import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LegalLayout } from '@/components/LegalLayout';

const Privacy = () => {
  const [content, setContent] = useState('');

  useEffect(() => {
    // Import the markdown file
    fetch('/src/legal/privacy.md')
      .then((res) => res.text())
      .then((text) => setContent(text))
      .catch(() => setContent('# Privacy Policy\n\nUnable to load privacy policy. Please contact hello@conversely.online'));
  }, []);

  return (
    <LegalLayout title="Privacy Policy" lastUpdated="October 6, 2025">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </LegalLayout>
  );
};

export default Privacy;
