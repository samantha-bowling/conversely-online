import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLegalSheet } from '@/hooks/useLegalSheet';
import { useSession } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { AboutSheet } from '@/components/AboutSheet';
import { LegalDocumentSheet } from '@/components/LegalDocumentSheet';
import { isWithinGracePeriod, getStoredSession } from '@/utils/sessionGracePeriod';

interface FooterProps {
  variant?: 'default' | 'chat' | 'legal';
  onReportClick?: () => void;
  onPrivacyRequestsClick?: () => void;
}

export const Footer = ({ variant = 'default', onReportClick, onPrivacyRequestsClick }: FooterProps) => {
  const { open, document, openTerms, openPrivacy, openDataRetention, setOpen } = useLegalSheet();
  const { session } = useSession();
  const [aboutOpen, setAboutOpen] = useState(false);

  // Check if we should show data management link
  // Show if: active session OR within grace period after expiry
  const showManageData = session || (() => {
    const stored = getStoredSession();
    return stored && isWithinGracePeriod(stored.expires_at);
  })();

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
        <Button 
          variant="link" 
          onClick={openDataRetention}
          className="p-0 h-auto text-xs text-muted-foreground hover:text-foreground"
        >
          Data Retention
        </Button>
        {showManageData && (
          <>
            <span>•</span>
            {onPrivacyRequestsClick ? (
              <button
                onClick={onPrivacyRequestsClick}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Manage My Data
              </button>
            ) : (
              <Link 
                to="/privacy-requests" 
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Manage My Data
              </Link>
            )}
          </>
        )}
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
      <LegalDocumentSheet open={open} onOpenChange={setOpen} document={document} />
      <AboutSheet open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  );
};
