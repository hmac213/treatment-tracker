"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, User, Calendar, Unlock, RotateCcw, SearchX, ArrowLeft } from 'lucide-react';

type User = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
};

type UnlockedNode = {
  node_id: string;
  unlocked_at: string;
  unlocked_by: string;
  source: string | null;
  node: {
    key: string;
    title: string;
  };
};

export function PatientLookup() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<User | null>(null);
  const [patientUnlocks, setPatientUnlocks] = useState<UnlockedNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Debounced search function
  const debouncedSearch = useCallback(
    async (term: string) => {
      if (!term.trim()) {
        setSearchResults([]);
        setHasSearched(false);
        return;
      }
      
      setLoading(true);
      setHasSearched(true);
      try {
        const res = await fetch('/api/admin/patients/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ searchTerm: term }),
        });
        const data = await res.json();
        setSearchResults(data.users || []);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Debounce the search
  useEffect(() => {
    const timer = setTimeout(() => {
      debouncedSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, debouncedSearch]);

  async function selectPatient(user: User) {
    setSelectedPatient(user);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/patients/${user.id}/unlocks`);
      const data = await res.json();
      setPatientUnlocks(data.unlocks || []);
    } catch (error) {
      console.error('Failed to load patient unlocks:', error);
    } finally {
      setLoading(false);
    }
  }

  function goBackToSearch() {
    setSelectedPatient(null);
    setPatientUnlocks([]);
  }

  async function unlockAllNodes(userId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/patients/${userId}/unlock-all`, {
        method: 'POST',
      });
      if (res.ok) {
        // Refresh the unlocks
        selectPatient(selectedPatient!);
      }
    } catch (error) {
      console.error('Failed to unlock all nodes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function resetPatientProgress(userId: string) {
    if (!confirm('Are you sure you want to reset all progress for this patient? This cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/patients/${userId}/reset`, {
        method: 'POST',
      });
      if (res.ok) {
        // Refresh the unlocks
        selectPatient(selectedPatient!);
      }
    } catch (error) {
      console.error('Failed to reset patient progress:', error);
    } finally {
      setLoading(false);
    }
  }

  // Show patient details view if a patient is selected
  if (selectedPatient) {
    return (
      <div className="space-y-6">
        {/* Back Button Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={goBackToSearch}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Search
          </Button>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{selectedPatient.name || 'No name'}</span>
            <span className="text-muted-foreground">({selectedPatient.email})</span>
          </div>
        </div>

        {/* Patient Management Card */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Patient Management
                </CardTitle>
                <CardDescription>
                  Manage {selectedPatient.name || selectedPatient.email}&apos;s progress and unlocks
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => unlockAllNodes(selectedPatient.id)}
                  disabled={loading}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Unlock className="h-4 w-4 mr-1" />
                  Unlock All
                </Button>
                <Button
                  onClick={() => resetPatientProgress(selectedPatient.id)}
                  disabled={loading}
                  size="sm"
                  variant="destructive"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset Progress
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Unlocked Nodes</h4>
                <Badge variant="secondary">
                  {patientUnlocks.length} unlocked
                </Badge>
              </div>
              <Separator />
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-muted-foreground border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-muted-foreground">Loading patient data...</p>
                </div>
              ) : patientUnlocks.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No nodes unlocked yet
                </p>
              ) : (
                <div className="space-y-3">
                  {patientUnlocks.map((unlock) => (
                    <Card key={unlock.node_id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{unlock.node.title}</p>
                            <p className="text-sm text-muted-foreground">
                              Key: {unlock.node.key}
                            </p>
                          </div>
                          <div className="text-right space-y-1">
                            <Badge variant="outline" className="text-xs">
                              {unlock.unlocked_by}
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                              {new Date(unlock.unlocked_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show search interface when no patient is selected
  return (
    <div className="space-y-6">
      {/* Search Section */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>

        {/* Search Results */}
        {hasSearched && searchResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Search Results</CardTitle>
              <CardDescription>
                Found {searchResults.length} patient(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => selectPatient(user)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">{user.name || 'No name'}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(user.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Results State */}
        {hasSearched && searchResults.length === 0 && !loading && (
          <Card>
            <CardContent className="p-8 text-center">
              <SearchX className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No results found</h3>
              <p className="text-muted-foreground">
                No patients found matching &quot;{searchTerm}&quot;. Try a different search term.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
