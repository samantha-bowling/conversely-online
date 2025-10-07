import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { recordAcceptance, markAgeGateSeen } from '@/utils/legalAcceptance';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface AgeGateProps {
  open: boolean;
  onAccept: () => void;
}

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
  { code: 'OTHER', name: 'Other' },
];

export const AgeGate = ({ open, onAccept }: AgeGateProps) => {
  const [country, setCountry] = useState<string>('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [showUnderageMessage, setShowUnderageMessage] = useState(false);

  const handleAgeChange = (confirmed: boolean) => {
    setAgeConfirmed(confirmed);
    if (!confirmed) {
      setShowUnderageMessage(true);
    } else {
      setShowUnderageMessage(false);
    }
  };

  const handleContinue = () => {
    if (country && ageConfirmed) {
      recordAcceptance(country);
      markAgeGateSeen();
      onAccept();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Welcome to Conversely</DialogTitle>
          <DialogDescription>
            Before you begin, we need to confirm a few things to comply with privacy laws.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Country Selection */}
          <div className="space-y-2">
            <Label htmlFor="country">Where are you located?</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger id="country">
                <SelectValue placeholder="Select your country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Age Confirmation */}
          <div className="space-y-3">
            <Label>Age Confirmation</Label>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleAgeChange(true)}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  ageConfirmed ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="font-medium">I am 16 years or older</div>
                <div className="text-sm text-muted-foreground">Required to use Conversely</div>
              </button>
              <button
                onClick={() => handleAgeChange(false)}
                className={`p-4 border rounded-lg text-left transition-colors ${
                  !ageConfirmed && showUnderageMessage ? 'border-destructive bg-destructive/10' : 'border-border hover:border-destructive/50'
                }`}
              >
                <div className="font-medium">I am under 16</div>
                <div className="text-sm text-muted-foreground">Sorry, you cannot use this service</div>
              </button>
            </div>
          </div>

          {/* Underage Warning */}
          {showUnderageMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Conversely is only available to users 16 years and older. If you are under 16, please close this page.
              </AlertDescription>
            </Alert>
          )}

          {/* Legal Links */}
          <div className="text-sm text-muted-foreground space-y-2">
            <p>By continuing, you agree to our:</p>
            <div className="flex gap-2">
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Terms of Service
              </a>
              <span>•</span>
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Privacy Policy
              </a>
            </div>
          </div>

          {/* Continue Button */}
          <Button
            onClick={handleContinue}
            disabled={!country || !ageConfirmed}
            className="w-full"
          >
            Continue to Conversely
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
