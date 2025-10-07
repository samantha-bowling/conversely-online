import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { recordAcceptance, markAgeGateSeen } from '@/utils/legalAcceptance';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Check } from 'lucide-react';
import { useLegalSheet } from '@/hooks/useLegalSheet';

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

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

// Generate year range (current year - 16 to current year - 120)
const getYearRange = () => {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 120;
  const endYear = currentYear - 16;
  const years = [];
  for (let y = endYear; y >= startYear; y--) {
    years.push(y);
  }
  return years;
};

// Get days in month (handle leap years)
const getDaysInMonth = (month: string, year: string) => {
  if (!month) return Array.from({ length: 31 }, (_, i) => i + 1);
  
  const monthNum = parseInt(month);
  const yearNum = year ? parseInt(year) : 2024;
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => i + 1);
};

// Calculate age and check eligibility
const calculateAge = (day: string, month: string, year: string): number => {
  const birthDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

export const AgeGate = ({ open, onAccept }: AgeGateProps) => {
  const { openTerms, openPrivacy, LegalSheet } = useLegalSheet();
  const [country, setCountry] = useState<string>('');
  const [day, setDay] = useState<string>('');
  const [month, setMonth] = useState<string>('');
  const [year, setYear] = useState<string>('');

  // Computed eligibility
  const isEligible = useMemo(() => {
    if (!day || !month || !year) return null;
    return calculateAge(day, month, year) >= 16;
  }, [day, month, year]);

  const handleContinue = () => {
    if (country && day && month && year && isEligible) {
      // Validate and discard DOB - only record country
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

          {/* Date of Birth */}
          <div className="space-y-3">
            <Label>Date of Birth</Label>
            <p className="text-sm text-muted-foreground">
              You must be 16 years or older to use Conversely
            </p>
            
            <div className="grid grid-cols-3 gap-3">
              {/* Day Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="day" className="text-xs">Day</Label>
                <Select value={day} onValueChange={setDay}>
                  <SelectTrigger id="day">
                    <SelectValue placeholder="DD" />
                  </SelectTrigger>
                  <SelectContent>
                    {getDaysInMonth(month, year).map((d) => (
                      <SelectItem key={d} value={d.toString()}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Month Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="month" className="text-xs">Month</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger id="month">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Year Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="year" className="text-xs">Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger id="year">
                    <SelectValue placeholder="YYYY" />
                  </SelectTrigger>
                  <SelectContent>
                    {getYearRange().map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Real-time Age Validation */}
            {isEligible !== null && (
              <>
                {isEligible ? (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-500">
                    <Check className="h-4 w-4" />
                    <span>You are eligible to use Conversely</span>
                  </div>
                ) : (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      You must be at least 16 years old to use Conversely. 
                      If you are under 16, please close this page.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>

          {/* Legal Links */}
          <div className="text-sm text-muted-foreground space-y-2">
            <p>By continuing, you agree to our:</p>
            <div className="flex gap-2">
              <Button
                variant="link"
                onClick={openTerms}
                className="p-0 h-auto text-sm text-primary hover:underline"
              >
                Terms of Service
              </Button>
              <span>•</span>
              <Button
                variant="link"
                onClick={openPrivacy}
                className="p-0 h-auto text-sm text-primary hover:underline"
              >
                Privacy Policy
              </Button>
            </div>
          </div>

          {/* Continue Button */}
          <Button
            onClick={handleContinue}
            disabled={!country || !day || !month || !year || !isEligible}
            className="w-full"
          >
            Continue to Conversely
          </Button>
        </div>
      </DialogContent>
      <LegalSheet />
    </Dialog>
  );
};
