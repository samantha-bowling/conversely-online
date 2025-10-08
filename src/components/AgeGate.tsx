import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { recordAcceptance, markAgeGateSeen, getAcceptance } from '@/utils/legalAcceptance';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Check, Info, MapPin, Loader2 } from 'lucide-react';
import { useLegalSheet } from '@/hooks/useLegalSheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { toast } from 'sonner';

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
  const dayNum = parseInt(day);
  const monthNum = parseInt(month) - 1; // 0-indexed
  const yearNum = parseInt(year);
  
  const birthDate = new Date(yearNum, monthNum, dayNum);
  
  // Validate the date wasn't rolled over by invalid input
  // e.g., Feb 30 becomes March 2, so getDate() !== 30
  if (
    birthDate.getDate() !== dayNum ||
    birthDate.getMonth() !== monthNum ||
    birthDate.getFullYear() !== yearNum
  ) {
    return -1; // Return invalid age to indicate bad date
  }
  
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
  const { initializeSession } = useSession();
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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);

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
    // Only validate when all fields are complete
    if (!day || !month || !year || year.length !== 4) return null;
    
    const yearNum = parseInt(year);
    const currentYear = new Date().getFullYear();
    
    // Validate year is within reasonable range
    if (yearNum < 1900 || yearNum > currentYear) return null;
    
    const age = calculateAge(day, month, year);
    
    // Invalid date (e.g., Feb 30, April 31)
    if (age < 0) return null;
    
    return age >= 16;
  }, [day, month, year]);

  // Check if legal documents have been viewed and accepted
  const legalDocsViewed = viewedTerms && viewedPrivacy;
  const legalDocsAccepted = acceptedTerms && acceptedPrivacy;

  const handleContinue = async () => {
    if (country && day && month && year && isEligible && legalDocsViewed && legalDocsAccepted) {
      setCreatingSession(true);
      
      try {
        // Record acceptance first
        recordAcceptance(country);
        markAgeGateSeen();
        
        // Create session with consent flag
        const success = await initializeSession();
        
        if (success) {
          console.log('Session created after age gate acceptance');
          onAccept();
        } else {
          toast.error('Failed to create session. Please try again.');
        }
      } catch (error) {
        console.error('Age gate completion error:', error);
        toast.error('An error occurred. Please try again.');
      } finally {
        setCreatingSession(false);
      }
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
              {/* Day Input */}
              <div className="space-y-2">
                <Label htmlFor="day" className="text-xs">Day</Label>
                <Input
                  id="day"
                  type="text"
                  inputMode="numeric"
                  placeholder="DD"
                  maxLength={2}
                  value={day}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value === '' || (parseInt(value) >= 1 && parseInt(value) <= 31)) {
                      setDay(value);
                    }
                  }}
                />
              </div>

              {/* Month Input */}
              <div className="space-y-2">
                <Label htmlFor="month" className="text-xs">Month</Label>
                <Input
                  id="month"
                  type="text"
                  inputMode="numeric"
                  placeholder="MM"
                  maxLength={2}
                  value={month}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value === '' || (parseInt(value) >= 1 && parseInt(value) <= 12)) {
                      setMonth(value);
                    }
                  }}
                />
              </div>

              {/* Year Input */}
              <div className="space-y-2">
                <Label htmlFor="year" className="text-xs">Year</Label>
                <Input
                  id="year"
                  type="text"
                  inputMode="numeric"
                  placeholder="YYYY"
                  maxLength={4}
                  value={year}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    const currentYear = new Date().getFullYear();
                    if (value === '' || value.length <= 4) {
                      setYear(value);
                    }
                  }}
                />
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
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">
                Please review our Terms of Service and Privacy Policy to{' '}
                <span className="inline-flex items-center gap-1">
                  continue
                  {needsLegalUpdate && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Our Terms of Service or Privacy Policy have been updated. Please review the updated documents.</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
              </p>
            </div>
            
            <div className="space-y-3">
              {/* Terms of Service */}
              <div className="space-y-2">
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
                  <span className="text-xs text-muted-foreground">
                    {viewedTerms ? '✓ Viewed' : 'View →'}
                  </span>
                </Button>
                
                {viewedTerms && (
                  <div className="flex items-center gap-2 pl-1">
                    <input
                      type="checkbox"
                      id="accept-terms"
                      checked={acceptedTerms}
                      disabled={!viewedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="h-4 w-4 rounded border-input disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <Label 
                      htmlFor="accept-terms"
                      className={`text-sm cursor-pointer ${!viewedTerms ? 'text-muted-foreground' : ''}`}
                    >
                      I accept the Terms of Service
                    </Label>
                  </div>
                )}
              </div>

              {/* Privacy Policy */}
              <div className="space-y-2">
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
                  <span className="text-xs text-muted-foreground">
                    {viewedPrivacy ? '✓ Viewed' : 'View →'}
                  </span>
                </Button>
                
                {viewedPrivacy && (
                  <div className="flex items-center gap-2 pl-1">
                    <input
                      type="checkbox"
                      id="accept-privacy"
                      checked={acceptedPrivacy}
                      disabled={!viewedPrivacy}
                      onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                      className="h-4 w-4 rounded border-input disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <Label 
                      htmlFor="accept-privacy"
                      className={`text-sm cursor-pointer ${!viewedPrivacy ? 'text-muted-foreground' : ''}`}
                    >
                      I accept the Privacy Policy
                    </Label>
                  </div>
                )}
              </div>
            </div>

            {legalDocsAccepted && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-500 pt-1">
                <Check className="h-4 w-4" />
                <span>Both documents accepted</span>
              </div>
            )}

            {!legalDocsViewed && (
              <p className="text-xs text-muted-foreground pt-1">
                View each document to enable acceptance checkboxes
              </p>
            )}
            
            {legalDocsViewed && !legalDocsAccepted && (
              <p className="text-xs text-muted-foreground pt-1">
                Please accept both documents to continue
              </p>
            )}
          </div>

          {/* Continue Button */}
          <Button
            onClick={handleContinue}
            disabled={!country || !day || !month || !year || !isEligible || !legalDocsViewed || !legalDocsAccepted || creatingSession}
            className="w-full"
          >
            {creatingSession ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating your session...
              </>
            ) : (
              'Start Conversing'
            )}
          </Button>
        </div>
      </DialogContent>
      <LegalSheet />
    </Dialog>
    </TooltipProvider>
  );
};
