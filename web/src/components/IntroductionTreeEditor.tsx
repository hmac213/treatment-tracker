'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { PlusCircle, Trash2, Save, Video } from 'lucide-react';
import { IntroductionMiniTree } from './IntroductionMiniTree';

type MiniTreeNode = {
  id: string;
  node_key: string;
  title: string;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  videos: Array<{
    id: string;
    video_url: string;
    title: string;
    order_index: number;
  }>;
};

export function IntroductionTreeEditor() {
  const [nodes, setNodes] = useState<MiniTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [nodeForms, setNodeForms] = useState<Record<string, MiniTreeNode>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchNodes();
  }, []);

  const fetchNodes = async () => {
    try {
      const response = await fetch('/api/admin/introduction-tree');
      if (response.ok) {
        const data = await response.json();
        setNodes(data.nodes || []);
      }
    } catch (error) {
      console.error('Failed to fetch nodes:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (node: MiniTreeNode) => {
    setEditingNode(node.id);
    setNodeForms({
      ...nodeForms,
      [node.id]: { ...node },
    });
  };

  const cancelEditing = (nodeId: string) => {
    setEditingNode(null);
    const newForms = { ...nodeForms };
    delete newForms[nodeId];
    setNodeForms(newForms);
  };

  const addVideo = (nodeId: string) => {
    const node = nodeForms[nodeId] || nodes.find(n => n.id === nodeId);
    if (!node) return;

    const videos = nodeForms[nodeId]?.videos || node.videos || [];
    setNodeForms({
      ...nodeForms,
      [nodeId]: {
        ...(nodeForms[nodeId] || node),
        videos: [
          ...videos,
          { id: '', video_url: '', title: '', order_index: videos.length },
        ],
      },
    });
  };

  const removeVideo = (nodeId: string, index: number) => {
    const node = nodeForms[nodeId] || nodes.find(n => n.id === nodeId);
    if (!node) return;

    const videos = nodeForms[nodeId]?.videos || node.videos || [];
    const newVideos = videos.filter((_, i) => i !== index).map((v, i) => ({
      ...v,
      order_index: i,
    }));
    setNodeForms({
      ...nodeForms,
      [nodeId]: {
        ...(nodeForms[nodeId] || node),
        videos: newVideos,
      },
    });
  };

  const updateVideo = (nodeId: string, index: number, field: string, value: string | number) => {
    const node = nodeForms[nodeId] || nodes.find(n => n.id === nodeId);
    if (!node) return;

    const videos = nodeForms[nodeId]?.videos || node.videos || [];
    const newVideos = [...videos];
    newVideos[index] = { ...newVideos[index], [field]: value };
    setNodeForms({
      ...nodeForms,
      [nodeId]: {
        ...(nodeForms[nodeId] || node),
        videos: newVideos,
      },
    });
  };

  const saveNode = async (nodeId: string) => {
    setSaving(nodeId);
    try {
      const node = nodeForms[nodeId] || nodes.find(n => n.id === nodeId);
      if (!node) return;

      const nodeData = nodeForms[nodeId] || node;
      const videos = nodeData.videos || [];
      const videosToSave = node.node_key === 'logistics' 
        ? [] 
        : videos.filter((v: any) => v.video_url && v.title);

      const response = await fetch('/api/admin/introduction-tree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert_node',
          node: {
            id: node.id,
            node_key: node.node_key,
            title: node.title,
            pos_x: node.pos_x,
            pos_y: node.pos_y,
            width: node.width,
            height: node.height,
            videos: videosToSave,
          },
        }),
      });

      if (response.ok) {
        setEditingNode(null);
        const newForms = { ...nodeForms };
        delete newForms[nodeId];
        setNodeForms(newForms);
        fetchNodes();
      } else {
        alert('Failed to save node');
      }
    } catch (error) {
      console.error('Error saving node:', error);
      alert('Error saving node');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  const createNode = async () => {
    const nodeKey = prompt('Enter a unique node key (e.g., "treatment_plan", "logistics"):');
    if (!nodeKey) return;

    const title = prompt('Enter the node title:');
    if (!title) return;

    try {
      const response = await fetch('/api/admin/introduction-tree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert_node',
          node: {
            node_key: nodeKey.toLowerCase().replace(/\s+/g, '_'),
            title: title,
            pos_x: 10,
            pos_y: 10,
            width: 15,
            height: 8,
            videos: [],
          },
        }),
      });

      if (response.ok) {
        fetchNodes();
      } else {
        alert('Failed to create node. Make sure the node key is unique.');
      }
    } catch (error) {
      console.error('Error creating node:', error);
      alert('Error creating node');
    }
  };

  return (
    <div className="space-y-4">
      <div className="w-full border rounded-lg overflow-hidden bg-white" style={{ height: 'calc(98vh - 200px)', minHeight: '600px' }}>
        <IntroductionMiniTree isAdmin={true} onUpdate={fetchNodes} />
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Nodes</h3>
        <Button onClick={createNode} variant="outline" size="sm" className="flex items-center gap-2">
          <PlusCircle className="h-4 w-4" />
          Create Node
        </Button>
      </div>

      {nodes.length === 0 ? (
        <div className="p-8 text-center text-gray-500 border rounded-lg">
          <p>No nodes yet. Click "Create Node" to add your first node.</p>
        </div>
      ) : (
        <div className="space-y-4">
        {nodes.map((node) => {
          const isEditing = editingNode === node.id;
          const nodeData = isEditing ? (nodeForms[node.id] || node) : node;
          const videos = nodeData.videos || [];
          const isSaving = saving === node.id;

          return (
            <Card key={node.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{node.title}</CardTitle>
                    <CardDescription>
                      {node.node_key === 'logistics' 
                        ? 'This node does not require videos.'
                        : `Manage videos for ${node.title}`}
                    </CardDescription>
                  </div>
                  {!isEditing && (
                    <Button onClick={() => startEditing(node)} variant="outline" size="sm">
                      <Video className="h-4 w-4 mr-2" />
                      Edit Videos
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="space-y-4">
                    {node.node_key === 'logistics' && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <strong>Note:</strong> This node does not require videos.
                        </p>
                      </div>
                    )}
                    {node.node_key !== 'logistics' && videos.length === 0 && (
                      <p className="text-sm text-gray-500">No videos yet. Click "Add Video" to add one.</p>
                    )}
                    {node.node_key !== 'logistics' && videos.map((video, index) => (
                      <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm font-medium">Video {index + 1}</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeVideo(node.id, index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div>
                          <Label htmlFor={`${node.id}-title-${index}`} className="text-xs font-medium text-gray-700">
                            Video Title
                          </Label>
                          <Input
                            id={`${node.id}-title-${index}`}
                            value={video.title}
                            onChange={(e) => updateVideo(node.id, index, 'title', e.target.value)}
                            placeholder="e.g., Introduction Video"
                            className="h-10 text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`${node.id}-url-${index}`} className="text-xs font-medium text-gray-700">
                            Video URL (Vimeo)
                          </Label>
                          <Input
                            id={`${node.id}-url-${index}`}
                            value={video.video_url}
                            onChange={(e) => updateVideo(node.id, index, 'video_url', e.target.value)}
                            placeholder="https://vimeo.com/..."
                            className="h-10 text-sm"
                          />
                        </div>
                      </div>
                    ))}
                    {node.node_key !== 'logistics' && (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => addVideo(node.id)}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <PlusCircle className="h-4 w-4" />
                          Add Video
                        </Button>
                        <Button
                          onClick={() => saveNode(node.id)}
                          disabled={isSaving}
                          className="flex items-center gap-2"
                        >
                          <Save className="h-4 w-4" />
                          {isSaving ? 'Saving...' : 'Save Changes'}
                        </Button>
                        <Button
                          onClick={() => cancelEditing(node.id)}
                          variant="outline"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                    {node.node_key === 'logistics' && (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => cancelEditing(node.id)}
                          variant="outline"
                          size="sm"
                        >
                          Close
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {node.node_key === 'logistics' ? (
                      <p className="text-sm text-gray-500 italic">This node does not require videos.</p>
                    ) : videos.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No videos configured for this node.</p>
                    ) : (
                      videos
                        .sort((a, b) => a.order_index - b.order_index)
                        .map((video) => (
                          <div key={video.id} className="p-3 bg-gray-50 rounded border border-gray-200">
                            <div className="font-medium text-sm">{video.title}</div>
                            <div className="text-xs text-gray-500 mt-1 truncate">{video.video_url}</div>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        </div>
      )}
    </div>
  );
}
