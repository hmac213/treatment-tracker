'use client';

import { useState, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VimeoPlayer } from './VimeoPlayer';
import { Lock, ZoomIn, ZoomOut, RotateCcw, Stethoscope } from 'lucide-react';

// Type definitions
type AppNode = {
  id: string;
  key: string;
  title: string;
  summary: string | null;
  video_url: string | null;
  is_root: boolean;
  categories?: string[];
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

type BranchingPromptInfo = {
  title: string;
  yesEdge: AppEdge;
  noEdge: AppEdge;
};

interface InteractiveSVGTreeProps {
  nodes: AppNode[];
  edges: AppEdge[];
  unlockedNodeIds: Set<string>;
  symptomsMap?: Map<string, string>; // symptom key -> label mapping
}

export function InteractiveSVGTree({ nodes, edges, unlockedNodeIds, symptomsMap = new Map() }: InteractiveSVGTreeProps) {
  // Component State
  const [selectedNode, setSelectedNode] = useState<AppNode | null>(null);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState<{ node: AppNode; edge: AppEdge } | null>(null);
  const [showBranchingPrompt, setShowBranchingPrompt] = useState<BranchingPromptInfo | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const wasDragged = useRef(false);

  const symptomPositions = new Map([
    ['calendula_silvadene', { x: 23.3, y: 44.8, width: 10.9, height: 5.8 }],
    ['silvadene_mepilex', { x: 23.3, y: 68.5, width: 13.1, height: 10.4 }],
    ['eat_any_liquid_diet', { x: 37.9, y: 45.5, width: 8.8, height: 6.2 }],
    ['liquid_diet_tube_feeding', { x: 37.9, y: 68.3, width: 9.1, height: 4.8 }],
    ['baking_2x_baking_4x', { x: 66, y: 43.2, width: 9, height: 6.5 }],
    ['baking_4x_mugard_direct', { x: 66, y: 62.3, width: 13.1, height: 8.1 }],
    ['lidocaine_dox_morph', { x: 79.1, y: 62.7, width: 8.7, height: 7.2 }],
    ['dox_morph_opioid', { x: 79.1, y: 87.9, width: 9, height: 7 }],
    ['dox_morph_branch', { x: 65.8, y: 79.7, width: 8.7, height: 6.5 }],
    ['baking_2x_supportive', { x: 53.6, y: 42.8, width: 8.5, height: 5.7 }],
    ['baking_2x_lidocaine', { x: 79.1, y: 43.1, width: 12.9, height: 6.1 }],
    ['supportive_medications_supplements', { x: 53.5, y: 61.7, width: 7.9, height: 5.6 }],
  ]);

  // Memoized data maps for performance
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  // Special handling for branching logic (Yes/No)
  const branchingEdges = useMemo(() => {
    const branches = new Map<string, {yes?: AppEdge, no?: AppEdge}>();
    const key = 'dox_morph_branch';
    const parentNode = nodes.find(n => n.key === 'dox_morph');
    if(parentNode) {
        const nervePainNode = nodes.find(n => n.key === 'nerve_pain');
        const yesEdgeForUnlock = edges.find(e => e.parent_id === nodeMap.get(nodes.find(n => n.key === 'opioid')?.id || '')?.id && e.child_id === nervePainNode?.id);
        const yesEdgeForPrompt: AppEdge | undefined = yesEdgeForUnlock ? { ...yesEdgeForUnlock, parent_id: parentNode.id, id: 'synthetic-yes-edge' } : undefined;

        const noEdge = edges.find(e => e.parent_id === parentNode.id && e.child_id === nodes.find(n => n.key === 'opioid')?.id);
        
        if (yesEdgeForPrompt && noEdge) {
            branches.set(key, { yes: yesEdgeForPrompt, no: noEdge });
        }
    }
    return branches;
  }, [edges, nodes, nodeMap]);

  // Event Handlers
  const getNodeState = (node: AppNode): 'unlocked' | 'locked' => unlockedNodeIds.has(node.id) ? 'unlocked' : 'locked';
  const handleNodeClick = (node: AppNode) => { if (getNodeState(node) === 'unlocked') { setSelectedNode(node); } };
  const handleUnlock = async (nodeId: string) => {
    try {
      const response = await fetch('/api/unlock-node', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nodeId }) });
      if (response.ok) { window.location.reload(); } else { alert('Failed to unlock node'); }
    } catch (error) { console.error('Error unlocking node:', error); alert('Failed to unlock node'); }
  };
  const handleWheel = (e: React.WheelEvent) => { e.preventDefault(); const delta = e.deltaY > 0 ? 0.9 : 1.1; setZoom(prev => Math.min(Math.max(prev * delta, 0.5), 3)); };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractiveElement = target.closest('[data-node-key], [data-symptom-diamond], .zoom-controls');

    if (e.button === 0 && !isInteractiveElement) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      wasDragged.current = true;
      setPanX(e.clientX - panStart.x);
      setPanY(e.clientY - panStart.y);
    }
  };
  
  const handleMouseUp = () => {
    setIsPanning(false);
    setTimeout(() => { wasDragged.current = false; }, 0);
  };
  
  const nodeAreas = new Map([
    ['root', { x: 38.5, y: 5.1, width: 22.9, height: 10.4 }],
    ['calendula', { x: 17.5, y: 26.8, width: 11.8, height: 10.5 }],
    ['silvadene', { x: 17.5, y: 50.7, width: 11.7, height: 10.4 }],
    ['mepilex', { x: 17.8, y: 75.7, width: 11.1, height: 11.2 }],
    ['eat_any', { x: 32.2, y: 26.7, width: 11.5, height: 13.7 }],
    ['liquid_diet', { x: 32.3, y: 50.7, width: 11.3, height: 10.3 }],
    ['tube_feeding', { x: 32.0, y: 76.2, width: 11.7, height: 12.2 }],
    ['baking_2x', { x: 59.8, y: 24.7, width: 12.9, height: 12.6 }],
    ['supportive', { x: 48.2, y: 50.1, width: 10.6, height: 6.5 }],
    ['medications_supplements', { x: 48.2, y: 67.2, width: 10.6, height: 11.0 }],
    ['baking_4x', { x: 60.2, y: 50.2, width: 11.7, height: 6.6 }],
    ['mugard_direct', { x: 60.2, y: 70.2, width: 11.6, height: 5.0 }],
    ['lidocaine', { x: 73.3, y: 50.2, width: 11.5, height: 6.3 }],
    ['dox_morph', { x: 73.8, y: 70.2, width: 10.5, height: 11.1 }],
    ['opioid', { x: 60.5, y: 84.6, width: 10.5, height: 10.3 }],
    ['nerve_pain', { x: 48.3, y: 80.7, width: 10.6, height: 11.1 }],
  ]);

  // Render method
  const renderActualSVG = () => (
    <div className="relative w-full h-screen overflow-hidden" onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} style={{ cursor: isPanning ? 'grabbing' : 'grab' }}>
      {/* UI Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 zoom-controls" style={{ pointerEvents: 'auto', zIndex: 99999, position: 'fixed' }}>
        <Button size="icon" variant="outline" title="Zoom In" onClick={() => setZoom(z => Math.min(z * 1.2, 3))}><ZoomIn className="w-4 h-4" /></Button>
        <Button size="icon" variant="outline" title="Zoom Out" onClick={() => setZoom(z => Math.max(z / 1.2, 0.5))}><ZoomOut className="w-4 h-4" /></Button>
        <Button size="icon" variant="outline" title="Reset Zoom" onClick={() => { setZoom(1); setPanX(0); setPanY(0); }}><RotateCcw className="w-4 h-4" /></Button>
      </div>
      <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded text-sm" style={{ zIndex: 99999, position: 'fixed' }}>{Math.round(zoom * 100)}%</div>

      {/* Pannable/Zoomable container */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, transformOrigin: 'center center', transition: isPanning ? 'none' : 'transform 0.2s ease-out' }}>
        <div ref={containerRef} className="relative w-full max-w-6xl" style={{ aspectRatio: '2505 / 2174' }}>
          <img src="/APERTURE decision tree real - Frame 1.svg" alt="Treatment Decision Tree" className="w-full h-full" draggable={false} style={{ pointerEvents: 'auto' }} />
          
          <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
            {/* Clickable Node Areas */}
            {Array.from(nodeAreas.entries()).map(([nodeKey, area]) => {
              const node = nodes.find(n => n.key === nodeKey);
              if (!node) return null;
              const state = getNodeState(node);
              return (
                <div key={nodeKey} data-node-key={nodeKey} onClick={() => { if (!wasDragged.current && state === 'unlocked') handleNodeClick(node); }}
                  className={`absolute transition-all duration-300 rounded select-none ${state === 'unlocked' ? 'border-3 border-green-500 cursor-pointer' : 'border-3 border-gray-400 bg-gray-500/20'}`}
                  style={{ left: `${area.x}%`, top: `${area.y}%`, width: `${area.width}%`, height: `${area.height}%`, pointerEvents: 'auto' }}>
                  {state === 'locked' && <div className="absolute inset-0 flex items-center justify-center"><Lock className="w-8 h-8 text-gray-700 opacity-75" /></div>}
                </div>
              );
            })}

            {/* Symptom Diamonds */}
            {edges.map(edge => {
              const parentNode = nodeMap.get(edge.parent_id);
              const childNode = nodeMap.get(edge.child_id);
              if (!parentNode || !childNode) return null;
              
              const positionKey = `${parentNode.key}_${childNode.key}`;
              const position = symptomPositions.get(positionKey);
              if (!position) return null;

              const isActuallyUnlockable = unlockedNodeIds.has(edge.parent_id) && !unlockedNodeIds.has(edge.child_id);
              if (!isActuallyUnlockable) return null;
              
              return (
                <div key={positionKey} data-symptom-diamond="true" title={positionKey}
                  className="absolute cursor-pointer z-10"
                  style={{ left: `${position.x}%`, top: `${position.y}%`, width: `${position.width}%`, height: `${position.height}%`, transform: 'translate(-50%, -50%)', pointerEvents: 'auto' }}
                  onClick={() => { if (!wasDragged.current) { setShowUnlockPrompt({ node: childNode, edge }); } }}>
                  <div className="relative w-full h-full group">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full"><polygon points="50,0 100,50 50,100 0,50" className="fill-transparent stroke-blue-500 group-hover:stroke-blue-600 transition-colors" strokeWidth="8" vectorEffect="non-scaling-stroke" /></svg>
                    <div className="absolute inset-0 flex items-center justify-center"><Stethoscope className="w-1/3 h-1/3 text-blue-500 group-hover:text-blue-600 transition-colors" /></div>
                  </div>
                </div>
              );
            })}
            
            {/* Special Branching Diamond */}
            {(() => {
              const branch = branchingEdges.get('dox_morph_branch');
              if (!branch || !branch.yes || !branch.no) return null;
              const isActuallyUnlockable = unlockedNodeIds.has(branch.yes.parent_id) && (!unlockedNodeIds.has(branch.yes.child_id) || !unlockedNodeIds.has(branch.no.child_id));
              if (!isActuallyUnlockable) return null;

              const position = symptomPositions.get('dox_morph_branch');
              if (!position) return null;
              
              return (
                  <div data-symptom-diamond="true" title="Pain in the Neck, Ear, or Nerves?"
                      className="absolute cursor-pointer z-10"
                      style={{ left: `${position.x}%`, top: `${position.y}%`, width: `${position.width}%`, height: `${position.height}%`, transform: 'translate(-50%, -50%)', pointerEvents: 'auto' }}
                      onClick={() => { if (!wasDragged.current) { setShowBranchingPrompt({ title: "Pain in the Neck, Ear, or Nerves?", yesEdge: branch.yes!, noEdge: branch.no! }); } }}>
                      <div className="relative w-full h-full group">
                          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full"><polygon points="50,0 100,50 50,100 0,50" className="fill-transparent stroke-blue-500 group-hover:stroke-blue-600 transition-colors" strokeWidth="8" vectorEffect="non-scaling-stroke" /></svg>
                          <div className="absolute inset-0 flex items-center justify-center"><Stethoscope className="w-1/3 h-1/3 text-blue-500 group-hover:text-blue-600 transition-colors" /></div>
                      </div>
                  </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={!!selectedNode} onOpenChange={() => setSelectedNode(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedNode && (
            <>
              <DialogHeader className="pr-8">
                <DialogTitle className="text-xl font-semibold">{selectedNode.title}</DialogTitle>
                {selectedNode.categories && selectedNode.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedNode.categories.map(category => (
                      <Badge key={category} variant="secondary" className="text-xs">{category.replace('_', ' ')}</Badge>
                    ))}
                  </div>
                )}
              </DialogHeader>
              <div className="space-y-4">
                {selectedNode.video_url && <div className="aspect-video"><VimeoPlayer videoUrl={selectedNode.video_url} /></div>}
                {selectedNode.summary && (
                  <div>
                    <h3 className="font-medium mb-2">Details</h3>
                    <p className="text-gray-700">{selectedNode.summary}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!showUnlockPrompt} onOpenChange={() => setShowUnlockPrompt(null)}>
        <DialogContent className="max-w-md">
          {showUnlockPrompt && (
            <>
              <DialogHeader>
                <DialogTitle>Unlock Treatment Step</DialogTitle>
                <DialogDescription>
                  <div className="space-y-2">
                    <p><strong>Step:</strong> {showUnlockPrompt.node.title}</p>
                    <p><strong>Required symptoms:</strong> {((edge: AppEdge) => { const s = []; if (edge.unlock_type === 'symptom_match' && edge.unlock_value) { const r = edge.unlock_value as { any?: string[], all?: string[] }; s.push(...(r.any||[]), ...(r.all||[])); } return s.map(k=>symptomsMap.get(k)||k).join(', '); })(showUnlockPrompt.edge)}</p>
                    <p className="text-sm text-gray-600 mt-2">Do you currently have these symptoms?</p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowUnlockPrompt(null)}>No, I don&apos;t have these symptoms</Button>
                <Button onClick={() => { handleUnlock(showUnlockPrompt.node.id); setShowUnlockPrompt(null); }} className="bg-green-600 hover:bg-green-700">Yes, I have these symptoms</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Branching Unlock Prompt */}
      <Dialog open={!!showBranchingPrompt} onOpenChange={() => setShowBranchingPrompt(null)}>
        <DialogContent className="max-w-md">
          {showBranchingPrompt && (
            <>
              <DialogHeader>
                <DialogTitle>{showBranchingPrompt.title}</DialogTitle>
                <DialogDescription>Do you have this symptom?</DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => { handleUnlock(showBranchingPrompt.noEdge.child_id); setShowBranchingPrompt(null); }}>No</Button>
                <Button onClick={() => { handleUnlock(showBranchingPrompt.yesEdge.child_id); setShowBranchingPrompt(null); }}>Yes</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  return <div className="w-full h-full">{renderActualSVG()}</div>;
}
