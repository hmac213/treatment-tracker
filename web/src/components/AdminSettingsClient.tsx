"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Database, Trash2 } from 'lucide-react';

export function AdminSettingsClient() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [selectedAction, setSelectedAction] = useState<'users' | 'unlocks' | 'all' | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const clearActions = [
    {
      id: 'users' as const,
      title: 'Clear All User Data',
      description: 'Remove all users except admin accounts',
      icon: <Database className="h-5 w-5" />,
      variant: 'destructive' as const,
    },
    {
      id: 'unlocks' as const,
      title: 'Clear All User Progress',
      description: 'Reset all user unlocks and progress data',
      icon: <Trash2 className="h-5 w-5" />,
      variant: 'destructive' as const,
    },
    {
      id: 'all' as const,
      title: 'Clear All Data',
      description: 'WARNING: Remove ALL data except admin accounts and core tree structure',
      icon: <AlertTriangle className="h-5 w-5" />,
      variant: 'destructive' as const,
    },
  ];

  const handleClearData = (action: 'users' | 'unlocks' | 'all') => {
    setSelectedAction(action);
    setConfirmText('');
    setIsDialogOpen(true);
  };

  const executeAction = async () => {
    if (!selectedAction || confirmText !== 'delete data') return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/clear-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: selectedAction }),
      });

      if (!response.ok) {
        throw new Error('Failed to clear data');
      }

      alert(`Successfully cleared ${selectedAction} data`);
      setIsDialogOpen(false);
      setConfirmText('');
      setSelectedAction(null);
    } catch (error) {
      alert('Error clearing data: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedActionInfo = selectedAction ? clearActions.find(a => a.id === selectedAction) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Database Management</h2>
        <p className="text-sm text-muted-foreground mb-4">
          These actions will permanently delete data. Use with extreme caution.
        </p>
      </div>

      <Separator />

      <div className="grid gap-4">
        {clearActions.map((action) => (
          <div key={action.id} className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              {action.icon}
              <div>
                <h3 className="font-medium">{action.title}</h3>
                <p className="text-sm text-muted-foreground">{action.description}</p>
              </div>
            </div>
            <Button
              variant={action.variant}
              onClick={() => handleClearData(action.id)}
              className="ml-4"
            >
              Clear Data
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Data Deletion
            </DialogTitle>
            <DialogDescription>
              {selectedActionInfo && (
                <>
                  You are about to: <strong>{selectedActionInfo.title}</strong>
                  <br />
                  <br />
                  {selectedActionInfo.description}
                  <br />
                  <br />
                  <strong>This action cannot be undone.</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="confirm">
                Type <strong>&quot;delete data&quot;</strong> to confirm:
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="delete data"
                className="col-span-3"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={executeAction}
              disabled={confirmText !== 'delete data' || isLoading}
            >
              {isLoading ? 'Deleting...' : 'Delete Data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
