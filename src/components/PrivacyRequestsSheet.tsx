import { Download, Trash2, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useSession } from '@/contexts/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Link, useNavigate } from 'react-router-dom';

interface PrivacyRequestsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PrivacyRequestsSheet = ({ open, onOpenChange }: PrivacyRequestsSheetProps) => {
  const { session } = useSession();
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    if (!session?.expires_at) return;

    const updateTimeRemaining = () => {
      const now = new Date();
      const expiresAt = new Date(session.expires_at);
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeRemaining(`${hours}h ${minutes}m`);
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 60000);
    return () => clearInterval(interval);
  }, [session]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-user-data');
      
      if (error) throw error;

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversely-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Data exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmation !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user-data', {
        body: { confirmation: 'DELETE_MY_DATA' }
      });

      if (error) throw error;

      console.log('[PrivacyRequestsSheet] Deletion response:', data);

      // Auto-download deletion receipt if available
      if (data?.receipt) {
        const blob = new Blob([JSON.stringify(data.receipt, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `conversely-deletion-receipt-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        
        // Wait for download to trigger before cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
        
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('[PrivacyRequestsSheet] Deletion receipt download triggered');
        toast.success('All data deleted successfully. Receipt downloaded.');
      } else {
        console.warn('[PrivacyRequestsSheet] No receipt in response:', data);
        toast.success('All data deleted successfully');
      }

      setShowDeleteDialog(false);
      onOpenChange(false);
      
      // Navigate to home after delay to ensure download completes
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete data');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!session) {
    return null;
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:w-[420px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Privacy Requests</SheetTitle>
            <SheetDescription>
              Exercise your data protection rights
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            {/* Session Status */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Session Expires In</p>
                    <p className="text-lg font-bold">{timeRemaining}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  All data is automatically deleted after 24 hours
                </p>
              </CardContent>
            </Card>

            {/* What Data We Store */}
            <Card>
              <CardHeader>
                <CardTitle>What Data We Store</CardTitle>
                <CardDescription>
                  Your ephemeral session contains:
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Survey answers (5 questions)</li>
                  <li>Chat room participation history</li>
                  <li>Message counts (content expires in 2 minutes)</li>
                  <li>Conversation feedback/ratings</li>
                </ul>
                <div className="flex items-start gap-2 mt-4 p-3 bg-muted/50 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    No emails, phone numbers, or permanent identifiers are stored
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Your Rights</CardTitle>
                <CardDescription>
                  Manage your data and privacy preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={handleExport}
                  disabled={isExporting}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {isExporting ? 'Exporting...' : 'Export My Data'}
                </Button>

                <Button
                  onClick={() => setShowDeleteDialog(true)}
                  variant="destructive"
                  className="w-full justify-start"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete All My Data
                </Button>
              </CardContent>
            </Card>

            <div className="text-center text-sm text-muted-foreground">
              <p>
                For more information, see our{' '}
                <Link 
                  to="/privacy"
                  className="text-primary hover:underline"
                  onClick={() => onOpenChange(false)}
                >
                  Privacy Policy
                </Link>
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete All Data?</DialogTitle>
            <DialogDescription>
              This will immediately and permanently delete your session data, including:
            </DialogDescription>
          </DialogHeader>
          
          <ul className="text-sm space-y-1 ml-4 list-disc">
            <li>Survey answers</li>
            <li>Chat room history</li>
            <li>Messages and reflections</li>
            <li>Your guest session</li>
          </ul>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Type <span className="font-mono font-bold">DELETE</span> to confirm:
            </p>
            <Input
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="DELETE"
              className="font-mono"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmation('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting || deleteConfirmation !== 'DELETE'}
            >
              {isDeleting ? 'Deleting...' : 'Delete Forever'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
