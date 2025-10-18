import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { recordAcceptance, markAgeGateSeen, getAcceptance } from '@/utils/legalAcceptance';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Check, Info, MapPin, Loader2 } from 'lucide-react';
import { useLegalSheet } from '@/hooks/useLegalSheet';
import { LegalDocumentSheet } from '@/components/LegalDocumentSheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { toast } from 'sonner';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { ERROR_MESSAGES } from '@/config/constants';

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
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const captchaRef = useRef<HCaptcha>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { open: legalOpen, document, openTerms, openPrivacy, setOpen: setLegalOpen } = useLegalSheet();
  const { ensureAnonAuth, initializeSession } = useSession();
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
  const [submitting, setSubmitting] = useState(false);
  const [captchaExecuting, setCaptchaExecuting] = useState(false);
  const [captchaTokenResolver, setCaptchaTokenResolver] = useState<{
    resolve: (token: string) => void;
    reject: (error: Error) => void;
  } | null>(null);

  // Track when legal sheet closes to mark document as viewed
  const lastOpenDocRef = useRef<'terms' | 'privacy' | 'data-retention' | null>(null);
  
  useEffect(() => {
    if (legalOpen) {
      lastOpenDocRef.current = document;
    } else if (lastOpenDocRef.current) {
      // Sheet just closed, mark document as viewed
      if (lastOpenDocRef.current === 'terms') {
        setViewedTerms(true);
      } else if (lastOpenDocRef.current === 'privacy') {
        setViewedPrivacy(true);
      }
      lastOpenDocRef.current = null;
    }
  }, [legalOpen, document]);

  // Unmount safety and cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

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

  const executeCaptcha = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      setCaptchaTokenResolver({ resolve, reject });
      setCaptchaExecuting(true);
      
      // Set 10-second timeout
      timeoutRef.current = setTimeout(() => {
        setCaptchaExecuting(false);
        setCaptchaTokenResolver(null);
        reject(new Error(ERROR_MESSAGES.CAPTCHA_TIMEOUT));
      }, 10000);

      // Execute captcha
      captchaRef.current?.execute();
    });
  };

  const handleCaptchaVerify = (token: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setCaptchaExecuting(false);
    captchaTokenResolver?.resolve(token);
    setCaptchaTokenResolver(null);
  };

  const handleCaptchaError = (error: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setCaptchaExecuting(false);
    console.error('[AgeGate] Captcha error:', error);
    captchaTokenResolver?.reject(new Error(ERROR_MESSAGES.CAPTCHA_FAILED));
    setCaptchaTokenResolver(null);
  };

  const handleCaptchaExpire = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setCaptchaExecuting(false);
    captchaTokenResolver?.reject(new Error(ERROR_MESSAGES.CAPTCHA_FAILED));
    setCaptchaTokenResolver(null);
  };

  const handleContinue = async () => {
    if (submitting || captchaExecuting) return; // Prevent double-clicks
    if (!(country && day && month && year && isEligible && legalDocsViewed && legalDocsAccepted)) return;
    
    setSubmitting(true);
    const start = performance.now();
    
    try {
      // Step 1: Ensure anonymous auth exists
      console.log('[AgeGate] Step 1: Ensuring anonymous auth...');
      await ensureAnonAuth();
      if (!mountedRef.current) return;
      
      // Step 2: Execute hCaptcha (if enabled)
      let captchaToken: string | undefined;
      const captchaEnabled = import.meta.env.VITE_HCAPTCHA_ENABLED === 'true';
      
      if (captchaEnabled) {
        console.log('[AgeGate] Step 2: Executing hCaptcha...');
        try {
          captchaToken = await executeCaptcha();
          console.log('[AgeGate] Captcha verified successfully');
        } catch (captchaError) {
          console.error('[AgeGate] Captcha execution failed:', captchaError);
          const errorMessage = captchaError instanceof Error 
            ? captchaError.message 
            : ERROR_MESSAGES.CAPTCHA_FAILED;
          toast.error(errorMessage);
          return;
        }
      }
      
      if (!mountedRef.current) return;
      
      // Step 3: Record legal acceptance
      console.log('[AgeGate] Step 3: Recording legal acceptance...');
      recordAcceptance(country);
      markAgeGateSeen();
      
      // Step 4: Preload Survey route in parallel with session creation
      console.log('[AgeGate] Step 4: Creating session and preloading Survey...');
      const [sessionData] = await Promise.all([
        initializeSession(captchaToken),
        import('@/pages/Survey').catch(err => {
          console.warn('[AgeGate] Survey preload failed (non-critical):', err);
        })
      ]);
      
      if (!mountedRef.current) return;
      
      const duration = (performance.now() - start).toFixed(0);
      console.log(`[AgeGate] Session flow completed (${duration}ms)`);
      
      // Step 5: Navigate imperatively
      onAccept(); // Close the dialog
      navigate('/survey', { replace: true });
      
    } catch (error) {
      if (!mountedRef.current) return;
      
      console.error('[AgeGate] Session creation failed:', error);
      
      // Map error to user-facing message
      const errorMessage = error instanceof Error && error.message.includes('rate')
        ? 'Too many attempts. Please wait a moment and try again.'
        : 'Failed to create session. Please try again.';
      
      toast.error(errorMessage);
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
        setCaptchaExecuting(false);
      }
    }
  };

  const handleOpenTerms = () => {
    openTerms();
  };

  const handleOpenPrivacy = () => {
    openPrivacy();
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

        {/* Invisible hCaptcha */}
        {import.meta.env.VITE_HCAPTCHA_ENABLED === 'true' && (
          <div style={{ display: 'none' }} aria-hidden="true">
            <HCaptcha
              ref={captchaRef}
              sitekey={import.meta.env.VITE_HCAPTCHA_SITE_KEY}
              onVerify={handleCaptchaVerify}
              onError={handleCaptchaError}
              onExpire={handleCaptchaExpire}
              size="invisible"
            />
          </div>
        )}
        
        {/* Noscript fallback */}
        <noscript>
          <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
            <p className="text-sm">Please enable JavaScript to continue. Human verification requires it.</p>
          </div>
        </noscript>

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
                Please review and accept our Terms of Service and Privacy Policy to{' '}
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
          </div>

          {/* Continue Button */}
          <Button
            onClick={handleContinue}
            disabled={!country || !day || !month || !year || !isEligible || !legalDocsViewed || !legalDocsAccepted || submitting || captchaExecuting}
            className="w-full"
            style={{
              pointerEvents: (submitting || captchaExecuting) ? 'none' : 'auto'
            }}
            aria-busy={submitting || captchaExecuting}
          >
            {submitting || captchaExecuting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {captchaExecuting ? 'Verifying...' : 'Preparing your session...'}
              </span>
            ) : (
              "Continue to Survey"
            )}
          </Button>
        </div>
      </DialogContent>
      <LegalDocumentSheet open={legalOpen} onOpenChange={setLegalOpen} document={document} />
    </Dialog>
    </TooltipProvider>
  );
};
