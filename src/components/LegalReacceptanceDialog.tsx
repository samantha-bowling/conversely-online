import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { recordAcceptance, getAcceptance } from '@/utils/legalAcceptance';

interface LegalReacceptanceDialogProps {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const LegalReacceptanceDialog = ({ open, onAccept, onDecline }: LegalReacceptanceDialogProps) => {
  const handleAccept = () => {
    const currentAcceptance = getAcceptance();
    const country = currentAcceptance?.country || 'OTHER';
    recordAcceptance(country);
    onAccept();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Legal Documents Updated</DialogTitle>
          <DialogDescription>
            Our Terms of Service or Privacy Policy have been updated with material changes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              To continue using Conversely, please review and accept the updated legal documents.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Please review the following documents:
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-sm"
              >
                → Terms of Service (Updated October 6, 2025)
              </a>
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-sm"
              >
                → Privacy Policy (Updated October 6, 2025)
              </a>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Changes include updates to data retention policies, security measures, and user rights.
          </p>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onDecline}>
            Decline & Exit
          </Button>
          <Button onClick={handleAccept}>
            Accept & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
