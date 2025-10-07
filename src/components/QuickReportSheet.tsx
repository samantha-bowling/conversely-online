import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, AlertTriangle, ChevronDown } from 'lucide-react';
import { useLegalSheet } from '@/hooks/useLegalSheet';
import { useState } from 'react';

interface QuickReportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const QuickReportSheet = ({ open, onOpenChange }: QuickReportSheetProps) => {
  const { openTerms, LegalSheet } = useLegalSheet();
  const [showDetails, setShowDetails] = useState(false);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-6">
            <SheetTitle>Report Abuse</SheetTitle>
            <SheetDescription>Help us keep Conversely safe and respectful</SheetDescription>
          </SheetHeader>

          <div className="space-y-6">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                If you experienced immediate danger or illegal activity, please contact local authorities first.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Abuse Reporting System</CardTitle>
                <CardDescription>Coming in Phase 5B</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p className="text-muted-foreground">
                  This reporting portal will allow you to:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
                  <li>Report Terms of Service violations</li>
                  <li>Flag inappropriate content or behavior</li>
                  <li>Submit evidence (timestamps, room IDs)</li>
                  <li>Track the status of your report</li>
                </ul>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h3 className="font-semibold">Manual Reports</h3>
              <p className="text-sm text-muted-foreground">
                Until the portal is available, you can report abuse via email:
              </p>
              <Button asChild className="w-full" size="lg">
                <a href="mailto:hello@conversely.online?subject=Abuse Report">
                  <Mail className="w-4 h-4 mr-2" />
                  Email Abuse Report
                </a>
              </Button>
            </div>

            <div>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center justify-between w-full text-sm font-medium py-2 hover:text-foreground transition-colors"
              >
                <span>What to Include in Your Report</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
              </button>
              
              {showDetails && (
                <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside mt-2 pl-2">
                  <li>Date and approximate time of incident</li>
                  <li>Description of the violation</li>
                  <li>Any relevant details (partner username, conversation topic)</li>
                  <li>Note: Messages expire after 60 seconds and cannot be recovered</li>
                </ul>
              )}
            </div>

            <div className="text-xs text-muted-foreground pt-4 border-t border-border">
              <p className="font-medium mb-1">Response Time:</p>
              <p>We investigate all reports within 5 business days. Serious violations may result in IP bans.</p>
            </div>

            <div className="text-center text-sm text-muted-foreground pt-2">
              <p>
                Learn more about our policies in the{' '}
                <Button variant="link" onClick={openTerms} className="p-0 h-auto text-primary">
                  Terms of Service
                </Button>
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <LegalSheet />
    </>
  );
};
