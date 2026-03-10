import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ensureUserHasBasicUnlocks } from '@/lib/autoUnlock';
import { loadPatientViewData } from '@/lib/patientData';
import { useAuth } from '@/components/AuthProvider';
import { PatientTreeView } from '@/components/PatientTreeView';
import { InteractiveSVGTree } from '@/components/InteractiveSVGTree';

export function MePage() {
  const { user } = useAuth();
  const [data, setData] = useState<Awaited<ReturnType<typeof loadPatientViewData>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!user) return;
      try {
        await ensureUserHasBasicUnlocks(user.id);
        const result = await loadPatientViewData(user.id);
        if (active) setData(result);
      } catch (err) {
        if (active) setError((err as Error).message);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [user]);

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-lg">Please go back and enter your email.</p>
        <Link to="/" className="text-blue-600 underline">
          Back to home
        </Link>
      </main>
    );
  }

  if (error) {
    return <main className="mx-auto max-w-3xl p-6 text-red-600">{error}</main>;
  }

  if (!data) {
    return <main className="mx-auto max-w-3xl p-6">Loading...</main>;
  }

  return (
    <main className="w-full">
      <div className="lg:hidden mx-auto max-w-3xl p-6">
        <h1 className="text-3xl font-bold mb-6">Your Treatment Path</h1>
        <PatientTreeView treeStructure={data.treeStructure} />
      </div>

      <div className="hidden lg:block w-full h-screen">
        <InteractiveSVGTree
          nodes={data.nodes}
          edges={data.edges}
          unlockedNodeIds={data.unlockedNodeIds}
          symptomsMap={data.symptomsMap}
          categoryVideos={data.categoryVideos}
          categoryPositions={data.categoryPositions}
          bonusContentVideos={data.bonusContentVideos}
          bonusContentPositions={data.bonusContentPositions}
          nodePositions={data.nodePositions}
          symptomPositions={data.symptomPositions}
        />
      </div>
    </main>
  );
}
