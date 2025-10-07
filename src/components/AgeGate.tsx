import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { recordAcceptance, markAgeGateSeen, getAcceptance } from '@/utils/legalAcceptance';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Check, Info, MapPin, Loader2 } from 'lucide-react';
import { useLegalSheet } from '@/hooks/useLegalSheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';

interface AgeGateProps {
  open: boolean;
  onAccept: () => void;
  onClose?: () => void;
  needsLegalUpdate?: boolean;
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

export const AgeGate = ({ open, onAccept, onClose, needsLegalUpdate = false }: AgeGateProps) => {
  const { openTerms, openPrivacy, LegalSheet } = useLegalSheet();
  const [country, setCountry] = useState<string>('');
  const [day, setDay] = useState<string>('');
  const [month, setMonth] = useState<string>('');
  const [year, setYear] = useState<string>('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationDetected, setLocationDetected] = useState(false);
  const [detectedCountryName, setDetectedCountryName] = useState<string>('');
  const [manualSelection, setManualSelection] = useState(false);
  const [viewedTerms, setViewedTerms] = useState(false);
  const [viewedPrivacy, setViewedPrivacy] = useState(false);

  // Auto-detect location on mount
  useEffect(() => {
    if (open && !manualSelection && !country) {
      detectLocation();
    }
  }, [open, manualSelection]);

  // Pre-fill country from existing acceptance if returning user needs to re-accept
  useEffect(() => {
    if (open && needsLegalUpdate) {
      const existing = getAcceptance();
      if (existing?.country) {
        setCountry(existing.country);
        setLocationDetected(true);
      }
    }
  }, [open, needsLegalUpdate]);

  const detectLocation = async () => {
    setDetectingLocation(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-user-location');
      
      if (error) throw error;
      
      if (data?.country) {
        setCountry(data.country);
        setDetectedCountryName(data.countryName || '');
        setLocationDetected(true);
      }
    } catch (error) {
      console.error('Failed to detect location:', error);
      // Graceful fallback - user can select manually
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleManualSelection = () => {
    setManualSelection(true);
    setLocationDetected(false);
    setCountry('');
  };

  // Computed eligibility
  const isEligible = useMemo(() => {
    if (!day || !month || !year) return null;
    return calculateAge(day, month, year) >= 16;
  }, [day, month, year]);

  // Check if legal documents have been viewed
  const legalDocsViewed = viewedTerms && viewedPrivacy;

  const handleContinue = () => {
    if (country && day && month && year && isEligible && legalDocsViewed) {
      // Validate and discard DOB - only record country
      recordAcceptance(country);
      markAgeGateSeen();
      onAccept();
    }
  };

  const handleOpenTerms = () => {
    openTerms();
    setViewedTerms(true);
  };

  const handleOpenPrivacy = () => {
    openPrivacy();
    setViewedPrivacy(true);
  };

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose?.()}>
        <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Welcome to Conversely</DialogTitle>
          <DialogDescription>
            Before you begin, we need to confirm a few things to comply with privacy laws.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Legal Update Alert (for returning users) */}
          {needsLegalUpdate && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Legal Documents Updated</strong>
                <p className="mt-1 text-sm">
                  Our Terms of Service or Privacy Policy have been updated. Please review the updated documents below.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Country Selection */}
          <div className="space-y-2">
            <Label htmlFor="country">Where are you located?</Label>
            
            {detectingLocation && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Detecting location...</span>
              </div>
            )}

            <Select value={country} onValueChange={setCountry} disabled={detectingLocation}>
              <SelectTrigger id="country" className="relative">
                <SelectValue placeholder={detectingLocation ? "Detecting..." : "Select your country"} />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {locationDetected && !manualSelection && detectedCountryName && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Detected: {detectedCountryName}</span>
                </div>
                <Button 
                  variant="link" 
                  size="sm"
                  onClick={handleManualSelection}
                  className="h-auto p-0 text-xs"
                >
                  Select manually instead
                </Button>
              </div>
            )}
          </div>

          {/* Date of Birth */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <Label>Date of Birth</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>You must be 16 years or older to use Conversely</p>
                </TooltipContent>
              </Tooltip>
            </div>
            
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

          {/* Legal Document Review */}
          <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/30">
            <p className="text-sm font-medium">Please review our legal documents:</p>
            
            <div className="space-y-2">
              {/* Terms of Service */}
              <Button
                variant="outline"
                onClick={handleOpenTerms}
                className="w-full justify-between h-auto py-3 px-4"
              >
                <div className="flex items-center gap-2">
                  {viewedTerms ? (
                    <Check className="h-4 w-4 text-green-600 dark:text-green-500" />
                  ) : (
                    <div className="h-4 w-4 rounded-sm border-2 border-muted-foreground/50" />
                  )}
                  <span className="text-sm font-medium">Terms of Service</span>
                </div>
                <span className="text-xs text-muted-foreground">View →</span>
              </Button>

              {/* Privacy Policy */}
              <Button
                variant="outline"
                onClick={handleOpenPrivacy}
                className="w-full justify-between h-auto py-3 px-4"
              >
                <div className="flex items-center gap-2">
                  {viewedPrivacy ? (
                    <Check className="h-4 w-4 text-green-600 dark:text-green-500" />
                  ) : (
                    <div className="h-4 w-4 rounded-sm border-2 border-muted-foreground/50" />
                  )}
                  <span className="text-sm font-medium">Privacy Policy</span>
                </div>
                <span className="text-xs text-muted-foreground">View →</span>
              </Button>
            </div>

            {legalDocsViewed && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-500 pt-1">
                <Check className="h-4 w-4" />
                <span>Both documents viewed</span>
              </div>
            )}

            {!legalDocsViewed && (
              <p className="text-xs text-muted-foreground pt-1">
                Click each link to review before accepting
              </p>
            )}
          </div>

          {/* Continue Button */}
          <Button
            onClick={handleContinue}
            disabled={!country || !day || !month || !year || !isEligible || !legalDocsViewed}
            className="w-full"
          >
            Start Conversing
          </Button>
        </div>
      </DialogContent>
      <LegalSheet />
    </Dialog>
    </TooltipProvider>
  );
};
