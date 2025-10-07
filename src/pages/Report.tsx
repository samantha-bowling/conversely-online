import { Link } from 'react-router-dom';
import { ChevronLeft, Mail, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

const Report = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold">Report Abuse</h1>
            <p className="text-muted-foreground">
              Help us keep Conversely safe and respectful
            </p>
          </div>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              If you experienced immediate danger or illegal activity, please contact local authorities first.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Abuse Reporting System</CardTitle>
              <CardDescription>
                Coming in Phase 5B
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This reporting portal will allow you to:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
                <li>Report Terms of Service violations</li>
                <li>Flag inappropriate content or behavior</li>
                <li>Submit evidence (timestamps, room IDs)</li>
                <li>Track the status of your report</li>
              </ul>

              <div className="pt-4 border-t border-border">
                <p className="text-sm font-medium mb-2">Manual Reports</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Until the portal is available, you can report abuse via email:
                </p>
                <a
                  href="mailto:hello@conversely.online?subject=Abuse Report"
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                >
                  <Mail className="w-4 h-4" />
                  hello@conversely.online
                </a>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-sm font-medium mb-2">What to Include:</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Date and approximate time of incident</li>
                  <li>Description of the violation</li>
                  <li>Any relevant details (partner username, conversation topic)</li>
                  <li>Note: Messages expire after 15 minutes and cannot be recovered</li>
                </ul>
              </div>

              <div className="pt-4 text-xs text-muted-foreground">
                <p className="font-medium mb-1">Response Time:</p>
                <p>We investigate all reports within 5 business days. Serious violations may result in IP bans.</p>
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-muted-foreground">
            <p>
              Learn more about our policies in the{' '}
              <Link to="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Report;
