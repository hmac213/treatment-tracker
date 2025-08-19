"use client";

import { useCallback, useMemo, useState, useEffect } from 'react';
import ReactFlow, { Background, Controls, MiniMap, addEdge, Connection, Edge as RFEdge, Node as RFNode, NodeMouseHandler, EdgeMouseHandler, applyNodeChanges, NodeChange, EdgeChange, applyEdgeChanges } from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from '@dagrejs/dagre';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

import { Plus, Save, Trash2, LayoutGrid, Edit, Settings } from 'lucide-react';

type AppNode = { id: string; key: string; title: string; summary?: string | null; video_url?: string | null; is_root: boolean; order_index: number; pos_x?: number | null; pos_y?: number | null };
type AppEdge = { id: string; parent_id: string; child_id: string; unlock_type: 'always' | 'manual' | 'symptom_match'; unlock_value: unknown };
type Symptom = { id: string; key: string; label: string; description?: string | null };

type Json = unknown;

function uuid() { return crypto.randomUUID(); }

// Generate key from title: lowercase, spaces to underscores, keep numbers
function generateKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars except spaces and numbers
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}

function toRFNodes(nodes: AppNode[]): RFNode[] {
  return nodes.map((n, idx) => ({ id: n.id, position: { x: n.pos_x ?? (idx % 4) * 250, y: n.pos_y ?? Math.floor(idx / 4) * 150 }, data: { label: n.title }, type: 'default' }));
}
function toRFEdges(edges: AppEdge[]): RFEdge[] { return edges.map((e) => ({ id: e.id, source: e.parent_id, target: e.child_id, label: e.unlock_type })); }

function autoLayout(nodes: RFNode[], edges: RFEdge[]): RFNode[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.id, { width: 180, height: 40 });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  return nodes.map((n) => {
    const pos = g.node(n.id);
    if (!pos) return n;
    return { ...n, position: { x: pos.x - 90, y: pos.y - 20 } };
  });
}

export function TreeEditor({ initialNodes, initialEdges }: { initialNodes: AppNode[]; initialEdges: AppEdge[] }) {
  const [nodes, setNodes] = useState<AppNode[]>(initialNodes);
  const [edges, setEdges] = useState<AppEdge[]>(initialEdges);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);

  const [rfNodes, setRfNodes] = useState<RFNode[]>(toRFNodes(initialNodes));
  const [rfEdges, setRfEdges] = useState<RFEdge[]>(toRFEdges(initialEdges));

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // Fetch symptoms on component mount
  useEffect(() => {
    async function fetchSymptoms() {
      try {
        const res = await fetch('/api/admin/symptoms');
        if (res.ok) {
          const data = await res.json();
          setSymptoms(data.symptoms || []);
        }
      } catch (error) {
        console.error('Failed to fetch symptoms:', error);
      }
    }
    fetchSymptoms();
  }, []);

  const onNodesChange = useCallback((changes: NodeChange[]) => setRfNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setRfEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const newEdge: AppEdge = { id: uuid(), parent_id: connection.source, child_id: connection.target, unlock_type: 'always', unlock_value: null };
    setEdges((e) => [...e, newEdge]);
    setRfEdges((eds) => addEdge({ ...connection, id: newEdge.id, label: 'always' }, eds));
  }, []);

  const [inspector, setInspector] = useState<{ type: 'node' | 'edge'; id: string } | null>(null);

  const onNodeClick: NodeMouseHandler = useCallback((_evt, rfNode) => {
    setInspector({ type: 'node', id: rfNode.id });
  }, []);
  const onEdgeClick: EdgeMouseHandler = useCallback((_evt, rfEdge) => {
    setInspector({ type: 'edge', id: rfEdge.id });
  }, []);

  const onNodeDoubleClick: NodeMouseHandler = useCallback((_evt, rfNode) => {
    setInspector({ type: 'node', id: rfNode.id });
  }, []);
  const onEdgeDoubleClick: EdgeMouseHandler = useCallback((_evt, rfEdge) => {
    setInspector({ type: 'edge', id: rfEdge.id });
  }, []);

  function addNode() {
    const id = uuid();
    const newNode: AppNode = { id, key: `node_${nodes.length + 1}`, title: 'New node', summary: '', video_url: '', is_root: false, order_index: nodes.length + 1, pos_x: 100, pos_y: 100 };
    setNodes((n) => [...n, newNode]);
    setRfNodes((arr) => [...arr, { id, position: { x: newNode.pos_x!, y: newNode.pos_y! }, data: { label: newNode.title }, type: 'default' }]);
    setInspector({ type: 'node', id });
  }

  function removeSelected() {
    const selectedIds = new Set<string>([...rfNodes.filter((n) => n.selected).map((n) => n.id), ...rfEdges.filter((e) => e.selected).map((e) => e.id)]);
    setNodes((n) => n.filter((x) => !selectedIds.has(x.id)));
    setEdges((e) => e.filter((x) => !selectedIds.has(x.id)));
    setRfNodes((ns) => ns.filter((n) => !n.selected));
    setRfEdges((es) => es.filter((e) => !e.selected));
    setInspector(null);
  }

  function doAutoLayout() { setRfNodes((ns) => autoLayout(ns, rfEdges)); }

  async function save() {
    const posMap = new Map(rfNodes.map((n) => [n.id, n.position]));
    const withPos = nodes.map((n) => { const p = posMap.get(n.id); return { ...n, pos_x: p?.x ?? n.pos_x ?? null, pos_y: p?.y ?? n.pos_y ?? null } as AppNode; });
    const res = await fetch('/api/admin/tree/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nodes: withPos, edges }) });
    if (res.ok) alert('Saved'); else alert('Failed to save');
  }

  const selectedNode = inspector?.type === 'node' ? nodeById.get(inspector.id) ?? null : null;
  const [nodeForm, setNodeForm] = useState<{ title: string; key: string; video_url: string; summary: string; is_root: boolean; keyManuallyEdited: boolean } | null>(null);
  useEffect(() => {
    if (selectedNode) {
      setNodeForm({ 
        title: selectedNode.title, 
        key: selectedNode.key, 
        video_url: selectedNode.video_url ?? '', 
        summary: selectedNode.summary ?? '', 
        is_root: selectedNode.is_root,
        keyManuallyEdited: false
      });
    } else {
      setNodeForm(null);
    }
  }, [selectedNode?.id]);

  // Auto-generate key when title changes (unless manually edited)
  const handleTitleChange = (title: string) => {
    if (!nodeForm) return;
    const newKey = nodeForm.keyManuallyEdited ? nodeForm.key : generateKey(title);
    setNodeForm({ ...nodeForm, title, key: newKey });
  };

  const handleKeyChange = (key: string) => {
    if (!nodeForm) return;
    setNodeForm({ ...nodeForm, key, keyManuallyEdited: true });
  };

  const selectedRfEdge = inspector?.type === 'edge' ? rfEdges.find((re) => re.id === inspector.id) ?? null : null;
  const selectedEdge = inspector?.type === 'edge' ? (edges.find((e) => e.id === inspector?.id || (e.parent_id === (selectedRfEdge?.source ?? '') && e.child_id === (selectedRfEdge?.target ?? ''))) ?? null) : null;
  const [edgeForm, setEdgeForm] = useState<{ 
    unlock_type: AppEdge['unlock_type']; 
    selectedSymptoms: string[];
    newSymptomName: string;
    symptomLogic: 'any' | 'all';
  } | null>(null);
  
  useEffect(() => {
    if (selectedEdge) {
      // Parse existing unlock_value to extract symptoms
      let selectedSymptoms: string[] = [];
      let symptomLogic: 'any' | 'all' = 'any';
      
      if (selectedEdge.unlock_value && typeof selectedEdge.unlock_value === 'object') {
        const value = selectedEdge.unlock_value as Record<string, unknown>;
        if (value.any && Array.isArray(value.any)) {
          selectedSymptoms = value.any as string[];
          symptomLogic = 'any';
        } else if (value.all && Array.isArray(value.all)) {
          selectedSymptoms = value.all as string[];
          symptomLogic = 'all';
        }
      }
      
      setEdgeForm({ 
        unlock_type: selectedEdge.unlock_type, 
        selectedSymptoms,
        newSymptomName: '',
        symptomLogic
      });
    } else {
      setEdgeForm(null);
    }
  }, [selectedEdge?.id]);

  function applyNodeEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedNode || !nodeForm) return;
    const updated: AppNode = { ...selectedNode, title: nodeForm.title, key: nodeForm.key, video_url: nodeForm.video_url, summary: nodeForm.summary, is_root: nodeForm.is_root };
    setNodes((arr) => arr.map((x) => x.id === selectedNode.id ? updated : x));
    setRfNodes((arr) => arr.map((x) => x.id === selectedNode.id ? { ...x, data: { label: updated.title } } : x));
  }

  function applyEdgeEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedEdge || !edgeForm) return;
    
    let unlock_value: Json = null;
    if (edgeForm.unlock_type === 'symptom_match' && edgeForm.selectedSymptoms.length > 0) {
      unlock_value = {
        [edgeForm.symptomLogic]: edgeForm.selectedSymptoms
      };
    }
    
    const updated: AppEdge = { ...selectedEdge, unlock_type: edgeForm.unlock_type, unlock_value };
    setEdges((arr) => arr.map((x) => x.id === selectedEdge.id ? updated : x));
    setRfEdges((arr) => arr.map((x) => (x.id === selectedEdge.id || (x.source === selectedEdge.parent_id && x.target === selectedEdge.child_id)) ? { ...x, label: updated.unlock_type } : x));
  }

  // Add new symptom
  async function addNewSymptom() {
    if (!edgeForm || !edgeForm.newSymptomName.trim()) return;
    
    const symptomKey = generateKey(edgeForm.newSymptomName);
    const newSymptom: Symptom = {
      id: uuid(),
      key: symptomKey,
      label: edgeForm.newSymptomName.trim(),
      description: null
    };
    
    try {
      const res = await fetch('/api/admin/symptoms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSymptom)
      });
      
      if (res.ok) {
        setSymptoms(prev => [...prev, newSymptom]);
        setEdgeForm({
          ...edgeForm,
          selectedSymptoms: [...edgeForm.selectedSymptoms, symptomKey],
          newSymptomName: ''
        });
      }
    } catch (error) {
      console.error('Failed to add symptom:', error);
    }
  }

  // Toggle symptom selection
  function toggleSymptom(symptomKey: string) {
    if (!edgeForm) return;
    const isSelected = edgeForm.selectedSymptoms.includes(symptomKey);
    const newSelection = isSelected 
      ? edgeForm.selectedSymptoms.filter(s => s !== symptomKey)
      : [...edgeForm.selectedSymptoms, symptomKey];
    
    setEdgeForm({ ...edgeForm, selectedSymptoms: newSelection });
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <Button onClick={addNode} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Node
          </Button>
          <Button onClick={doAutoLayout} variant="outline" size="sm">
            <LayoutGrid className="h-4 w-4 mr-1" />
            Auto Layout
          </Button>
          <Button onClick={removeSelected} variant="destructive" size="sm">
            <Trash2 className="h-4 w-4 mr-1" />
            Delete Selected
          </Button>
        </div>
        <Button onClick={save} className="bg-green-600 hover:bg-green-700">
          <Save className="h-4 w-4 mr-1" />
          Save All
        </Button>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex min-h-0">
        {/* Flow Chart */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
            fitView
            className="bg-background"
          >
            <Background color="#f1f5f9" />
            <MiniMap 
              nodeColor="#e2e8f0"
              maskColor="rgba(0, 0, 0, 0.1)"
              className="!bg-background border border-border"
            />
            <Controls className="!bg-background border border-border" />
          </ReactFlow>
        </div>

        {/* Inspector Panel - Fixed width and scrollable */}
        <div className="w-80 border-l bg-muted/20 flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto">
            {!selectedNode && !selectedEdge && (
              <div className="p-6 text-center text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a node or edge to edit its properties</p>
              </div>
            )}

            {selectedNode && nodeForm && (
              <Card className="m-4 border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Edit className="h-4 w-4" />
                    Edit Node
                  </CardTitle>
                  <CardDescription>
                    Modify node properties and content
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={applyNodeEdit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={nodeForm.title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        placeholder="Enter node title"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="key">Key (auto-generated)</Label>
                      <Input
                        id="key"
                        value={nodeForm.key}
                        onChange={(e) => handleKeyChange(e.target.value)}
                        placeholder="Auto-generated from title"
                        className="bg-muted/50"
                      />
                      <p className="text-xs text-muted-foreground">
                        Key is auto-generated from title. Edit to customize.
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="video_url">Video URL</Label>
                      <Input
                        id="video_url"
                        value={nodeForm.video_url}
                        onChange={(e) => setNodeForm({ ...nodeForm, video_url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="summary">Summary</Label>
                      <Textarea
                        id="summary"
                        value={nodeForm.summary}
                        onChange={(e) => setNodeForm({ ...nodeForm, summary: e.target.value })}
                        placeholder="Enter node summary"
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is_root"
                        checked={nodeForm.is_root}
                        onChange={(e) => setNodeForm({ ...nodeForm, is_root: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="is_root">Root node</Label>
                    </div>
                    
                    <Separator />
                    
                    <Button type="submit" className="w-full">
                      Apply Changes
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {selectedEdge && edgeForm && (
              <Card className="m-4 border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Edit className="h-4 w-4" />
                    Edit Edge
                  </CardTitle>
                  <CardDescription>
                    Configure unlock conditions and rules
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={applyEdgeEdit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="unlock_type">Unlock Type</Label>
                      <Select 
                        value={edgeForm.unlock_type} 
                        onValueChange={(value) => setEdgeForm({ ...edgeForm, unlock_type: value as AppEdge['unlock_type'] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="always">Always Unlocked</SelectItem>
                          <SelectItem value="manual">Manual Unlock</SelectItem>
                          <SelectItem value="symptom_match">Symptom Match</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {edgeForm.unlock_type === 'symptom_match' && (
                      <>
                        <Separator />
                        
                        <div className="space-y-2">
                          <Label>Symptom Logic</Label>
                          <Select 
                            value={edgeForm.symptomLogic} 
                            onValueChange={(value) => setEdgeForm({ ...edgeForm, symptomLogic: value as 'any' | 'all' })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any of the selected symptoms</SelectItem>
                              <SelectItem value="all">All of the selected symptoms</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Add New Symptom</Label>
                          <div className="flex gap-2">
                            <Input
                              value={edgeForm.newSymptomName}
                              onChange={(e) => setEdgeForm({ ...edgeForm, newSymptomName: e.target.value })}
                              placeholder="Enter symptom name"
                              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNewSymptom())}
                            />
                            <Button 
                              type="button" 
                              onClick={addNewSymptom}
                              disabled={!edgeForm.newSymptomName.trim()}
                              size="sm"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Select Symptoms ({edgeForm.selectedSymptoms.length} selected)</Label>
                          <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                            {symptoms.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No symptoms available. Add one above.
                              </p>
                            ) : (
                              symptoms.map((symptom) => (
                                <div key={symptom.key} className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    id={`symptom-${symptom.key}`}
                                    checked={edgeForm.selectedSymptoms.includes(symptom.key)}
                                    onChange={() => toggleSymptom(symptom.key)}
                                    className="rounded border-gray-300"
                                  />
                                  <Label 
                                    htmlFor={`symptom-${symptom.key}`}
                                    className="text-sm font-normal cursor-pointer flex-1"
                                  >
                                    <span className="font-medium">{symptom.label}</span>
                                    {symptom.description && (
                                      <span className="text-muted-foreground ml-1">
                                        - {symptom.description}
                                      </span>
                                    )}
                                  </Label>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                    
                    <Separator />
                    
                    <Button type="submit" className="w-full">
                      Apply Changes
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

