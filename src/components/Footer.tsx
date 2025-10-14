import { useState } from 'react';
import { useLegalSheet } from '@/hooks/useLegalSheet';
import { Button } from '@/components/ui/button';
import { AboutSheet } from '@/components/AboutSheet';

interface FooterProps {
  variant?: 'default' | 'chat' | 'legal';
  onReportClick?: () => void;
}

export const Footer = ({ variant = 'default', onReportClick }: FooterProps) => {
  const { openTerms, openPrivacy, LegalSheet } = useLegalSheet();
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
      <div className="text-center text-xs text-muted-foreground space-x-2">
        <Button 
          variant="link" 
          onClick={() => setAboutOpen(true)}
          className="p-0 h-auto text-xs text-muted-foreground hover:text-foreground"
        >
          About
        </Button>
        <span>•</span>
        <Button 
          variant="link" 
          onClick={openTerms}
          className="p-0 h-auto text-xs text-muted-foreground hover:text-foreground"
        >
          Terms
        </Button>
        <span>•</span>
        <Button 
          variant="link" 
          onClick={openPrivacy}
          className="p-0 h-auto text-xs text-muted-foreground hover:text-foreground"
        >
          Privacy
        </Button>
        <span>•</span>
        <a 
          href="/data-retention" 
          className="hover:text-foreground transition-colors"
        >
          Data Retention
        </a>
        <span>•</span>
        {variant === 'chat' ? (
          <Button 
            variant="link" 
            onClick={onReportClick}
            className="p-0 h-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Report
          </Button>
        ) : (
          <a 
            href="mailto:hello@conversely.online" 
            className="hover:text-foreground transition-colors"
          >
            Contact
          </a>
        )}
        {variant === 'legal' && (
          <>
            <br className="sm:hidden" />
            <span className="block sm:inline mt-2 sm:mt-0">
              © {new Date().getFullYear()} Conversely. All rights reserved.
            </span>
          </>
        )}
      </div>
      <LegalSheet />
      <AboutSheet open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  );
};
