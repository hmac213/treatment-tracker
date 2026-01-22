'use client';

import { useState, useEffect } from 'react';
import { InteractiveSVGTree } from './InteractiveSVGTree';
import { CategoryEditor } from './CategoryEditor';
import { BonusContentEditor } from './BonusContentEditor';
import { IntroductionTreeEditor } from './IntroductionTreeEditor';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

type AppNode = {
  id: string;
  key: string;
  title: string;
  summary: string | null;
  is_root: boolean;
  categories?: string[];
  node_videos: { id: string; video_url: string; title: string; order_index: number }[];
};

type AppEdge = {
  id: string;
  parent_id: string;
  child_id: string;
  unlock_type: 'always' | 'manual' | 'symptom_match';
  unlock_value: Record<string, unknown> | null;
  description?: string | null;
  weight?: number;
};

type CategoryVideo = {
  id: string;
  video_url: string;
  title: string;
  order_index: number;
};

type CategoryPosition = {
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
};

interface AdminTreeViewProps {
  initialNodes: AppNode[];
  initialEdges: AppEdge[];
}

export function AdminTreeView({ initialNodes, initialEdges }: AdminTreeViewProps) {
  const [categoryVideos, setCategoryVideos] = useState<Record<string, CategoryVideo[]>>({});
  const [categoryPositions, setCategoryPositions] = useState<Record<string, CategoryPosition>>({});
  const [bonusContentVideos, setBonusContentVideos] = useState<Record<string, CategoryVideo[]>>({});
  const [bonusContentPositions, setBonusContentPositions] = useState<Record<string, CategoryPosition>>({});
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number; width: number; height: number }>>({});
  const [symptomPositions, setSymptomPositions] = useState<Record<string, { x: number; y: number; width: number; height: number }>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tree' | 'categories' | 'bonus' | 'introduction'>('tree');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      // Fetch category data
      const categoryResponse = await fetch('/api/admin/category-videos');
      if (categoryResponse.ok) {
        const categoryData = await categoryResponse.json();
        setCategoryVideos(categoryData.videos || {});
        setCategoryPositions(categoryData.positions || {});
      }
      
      // Fetch bonus content data
      const bonusResponse = await fetch('/api/admin/bonus-content');
      if (bonusResponse.ok) {
        const bonusData = await bonusResponse.json();
        setBonusContentVideos(bonusData.videos || {});
        setBonusContentPositions(bonusData.positions || {});
      }
      
      // Fetch node and symptom positions
      const positionsResponse = await fetch('/api/admin/positions');
      if (positionsResponse.ok) {
        const positionsData = await positionsResponse.json();
        setNodePositions(positionsData.nodes || {});
        setSymptomPositions(positionsData.symptoms || {});
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Separate function to just refresh positions (for callbacks)
  const refreshPositions = async () => {
    try {
      const positionsResponse = await fetch('/api/admin/positions');
      if (positionsResponse.ok) {
        const positionsData = await positionsResponse.json();
        setNodePositions(positionsData.nodes || {});
        setSymptomPositions(positionsData.symptoms || {});
      }
    } catch (error) {
      console.error('Failed to refresh positions:', error);
    }
  };

  const handleCategoryPositionUpdate = async (category: string, position: CategoryPosition) => {
    try {
      const response = await fetch('/api/admin/category-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          position,
        }),
      });

      if (response.ok) {
        setCategoryPositions(prev => ({
          ...prev,
          [category]: position,
        }));
      } else {
        console.error('Failed to save position');
        alert('Failed to save position');
      }
    } catch (error) {
      console.error('Error saving position:', error);
      alert('Error saving position');
    }
  };

  const handleBonusContentPositionUpdate = async (category: string, position: CategoryPosition) => {
    try {
      const response = await fetch('/api/admin/bonus-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          position,
        }),
      });

      if (response.ok) {
        setBonusContentPositions(prev => ({
          ...prev,
          [category]: position,
        }));
      } else {
        console.error('Failed to save bonus content position');
        alert('Failed to save position');
      }
    } catch (error) {
      console.error('Error saving bonus content position:', error);
      alert('Error saving position');
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'tree' | 'categories' | 'bonus' | 'introduction')} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mb-4">
          <TabsTrigger value="tree">Tree View</TabsTrigger>
          <TabsTrigger value="categories">Category Videos</TabsTrigger>
          <TabsTrigger value="bonus">Bonus Content</TabsTrigger>
          <TabsTrigger value="introduction">Introduction Tree</TabsTrigger>
        </TabsList>

        <TabsContent value="tree" className="flex-1 flex flex-col min-h-0">
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader>
              <CardTitle>Interactive Tree Editor</CardTitle>
              <CardDescription>
                Use edit mode to position category video boxes. Click the edit button in the tree view.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0">
              <div className="w-full h-full">
                <InteractiveSVGTree
                  nodes={initialNodes}
                  edges={initialEdges}
                  unlockedNodeIds={new Set(initialNodes.map(n => n.id))}
                  symptomsMap={new Map()}
                  categoryVideos={categoryVideos}
                  categoryPositions={categoryPositions}
                  bonusContentVideos={bonusContentVideos}
                  bonusContentPositions={bonusContentPositions}
                  nodePositions={nodePositions}
                  symptomPositions={symptomPositions}
                  isAdmin={true}
                  onCategoryPositionUpdate={handleCategoryPositionUpdate}
                  onBonusContentPositionUpdate={handleBonusContentPositionUpdate}
                  onNodePositionUpdate={refreshPositions}
                  onSymptomPositionUpdate={refreshPositions}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="flex-1 flex flex-col min-h-0">
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader>
              <CardTitle>Category Video Editor</CardTitle>
              <CardDescription>
                Edit videos for each category label (Skincare, Nutrition, Oral Care, Pain)
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto">
              <CategoryEditor
                categoryVideos={categoryVideos}
                onUpdate={fetchAllData}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bonus" className="flex-1 flex flex-col min-h-0">
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader>
              <CardTitle>Bonus Content Editor</CardTitle>
              <CardDescription>
                Edit bonus content videos for each category (Skincare, Nutrition, Oral Care, Introduction)
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto">
              <BonusContentEditor
                bonusContentVideos={bonusContentVideos}
                onUpdate={fetchAllData}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="introduction" className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <IntroductionTreeEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
