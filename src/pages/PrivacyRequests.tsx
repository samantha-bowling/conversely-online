import { Link } from 'react-router-dom';
import { ChevronLeft, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Footer } from '@/components/Footer';
import { useLegalSheet } from '@/hooks/useLegalSheet';

const PrivacyRequests = () => {
  const { openPrivacy, LegalSheet } = useLegalSheet();

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
            <h1 className="text-4xl font-bold">Privacy Requests</h1>
            <p className="text-muted-foreground">
              Exercise your data protection rights
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Data Subject Rights Portal</CardTitle>
              <CardDescription>
                Coming in Phase 5B
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This self-service portal will allow you to:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
                <li>Request a copy of your data (Access Request)</li>
                <li>Delete your session and conversation data (Deletion Request)</li>
                <li>Export your survey responses (Data Portability)</li>
                <li>Opt-out of data processing (where applicable)</li>
              </ul>

              <div className="pt-4 border-t border-border">
                <p className="text-sm font-medium mb-2">Manual Requests</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Until the portal is available, you can submit privacy requests via email:
                </p>
                <a
                  href="mailto:hello@conversely.online?subject=Privacy Request"
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                >
                  <Mail className="w-4 h-4" />
                  hello@conversely.online
                </a>
              </div>

              <div className="pt-4 text-xs text-muted-foreground">
                <p className="font-medium mb-1">Response Time:</p>
                <p>We will respond to all privacy requests within 30 days (or as required by applicable law).</p>
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-muted-foreground">
            <p>
              For more information, see our{' '}
              <Button
                variant="link"
                onClick={openPrivacy}
                className="p-0 h-auto text-sm text-primary hover:underline"
              >
                Privacy Policy
              </Button>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-8">
        <div className="container mx-auto px-4">
          <Footer variant="default" />
        </div>
      </footer>

      <LegalSheet />
    </div>
  );
};

export default PrivacyRequests;
