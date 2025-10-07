'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VimeoPlayer } from './VimeoPlayer';
import { Lock, ZoomIn, ZoomOut, RotateCcw, Stethoscope } from 'lucide-react';

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

interface InteractiveSVGTreeProps {
  nodes: AppNode[];
  edges: AppEdge[];
  unlockedNodeIds: Set<string>;
}

export function InteractiveSVGTree({ nodes, edges, unlockedNodeIds }: InteractiveSVGTreeProps) {
  const [selectedNode, setSelectedNode] = useState<AppNode | null>(null);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState<{ node: AppNode; edge: AppEdge } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Build a map for quick lookups
  const edgesByParent = new Map<string, AppEdge[]>();
  
  edges.forEach(edge => {
    if (!edgesByParent.has(edge.parent_id)) {
      edgesByParent.set(edge.parent_id, []);
    }
    edgesByParent.get(edge.parent_id)!.push(edge);
  });

  // Determine if a node is immediately unlockable
  const getNodeState = (node: AppNode): 'unlocked' | 'immediately_unlockable' | 'locked' => {
    if (unlockedNodeIds.has(node.id)) return 'unlocked';
    
    // Check if any parent is unlocked and has an edge to this node
    const parentEdges = edges.filter(e => e.child_id === node.id);
    for (const edge of parentEdges) {
      if (unlockedNodeIds.has(edge.parent_id)) {
        return 'immediately_unlockable';
      }
    }
    
    return 'locked';
  };

  const handleNodeClick = (node: AppNode) => {
    const state = getNodeState(node);
    
    if (state === 'unlocked') {
      setSelectedNode(node);
    } else if (state === 'immediately_unlockable') {
      // Find the edge from an unlocked parent
      const availableEdge = edges.find(e => 
        e.child_id === node.id && unlockedNodeIds.has(e.parent_id)
      );
      if (availableEdge) {
        setShowUnlockPrompt({ node, edge: availableEdge });
      }
    }
    // For locked nodes, do nothing (or show a "not available" message)
  };

  const handleUnlock = async (nodeId: string) => {
    try {
      const response = await fetch('/api/unlock-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId })
      });

      if (response.ok) {
        window.location.reload(); // Refresh to show updated state
      } else {
        alert('Failed to unlock node');
      }
    } catch (error) {
      console.error('Error unlocking node:', error);
      alert('Failed to unlock node');
    }
  };

  // Perfectly positioned coordinates for each treatment node
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


  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.5), 3));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    console.log('Mouse down event fired');
    
    // Get the actual clicked element and trace up the DOM
    const target = e.target as HTMLElement;
    console.log('Target element:', target.tagName, target.className);
    console.log('Target closest button:', target.closest('button'));
    
    // Check if we clicked a button OR a treatment node
    const isButton = target.tagName === 'BUTTON';
    const parentButton = target.closest('button');
    const isInButtonContainer = target.closest('.zoom-controls');
    const isTreatmentNode = target.classList.contains('border-3') || target.closest('[data-node-key]');
    
    console.log('Is button:', isButton, 'Parent button:', parentButton, 'In button container:', isInButtonContainer);
    console.log('Is treatment node:', isTreatmentNode);
    
    if (isButton || parentButton || isInButtonContainer) {
      // Handle button clicks directly here
      e.stopPropagation();
      e.preventDefault();
      
      console.log('Button area clicked - preventing pan');
      
      // Find which button was clicked
      let buttonElement = isButton ? target : parentButton;
      if (!buttonElement && isInButtonContainer) {
        // If clicked on icon inside button, find the button
        buttonElement = target.closest('button') || target.parentElement?.closest('button') || null;
      }
      
      if (buttonElement) {
        const buttonTitle = buttonElement.getAttribute('title');
        console.log('Button title:', buttonTitle);
        
        if (buttonTitle === 'Zoom In') {
          console.log('Executing Zoom In');
          setZoom(prev => Math.min(prev * 1.2, 3));
        } else if (buttonTitle === 'Zoom Out') {
          console.log('Executing Zoom Out');
          setZoom(prev => Math.max(prev / 1.2, 0.5));
        } else if (buttonTitle === 'Reset Zoom') {
          console.log('Executing Reset Zoom');
          setZoom(1);
          setPanX(0);
          setPanY(0);
        }
      }
      return; // Don't start panning
    }
    
    // Check if we clicked a treatment node - if so, don't start panning
    if (isTreatmentNode) {
      console.log('Treatment node clicked - letting node handle it, preventing pan');
      return; // Let the node's own onClick handler deal with it
    }
    
    console.log('Starting pan - no button or node detected');
    // Only start panning if no button or node was clicked
    if (e.button === 0) { // Left mouse button
      setIsPanning(true);
      setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanX(e.clientX - panStart.x);
      setPanY(e.clientY - panStart.y);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const renderActualSVG = () => {
    return (
      <div 
        className="relative w-full h-screen overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      >
        {/* Zoom Controls */}
        <div 
          className="absolute top-4 right-4 flex flex-col gap-2 zoom-controls"
          style={{ pointerEvents: 'auto', zIndex: 99999, position: 'fixed' }}
        >
          <button
            className="w-10 h-10 bg-white/90 hover:bg-white border border-gray-300 rounded-md flex items-center justify-center shadow-sm hover:shadow-md transition-all"
            title="Zoom In"
            type="button"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            className="w-10 h-10 bg-white/90 hover:bg-white border border-gray-300 rounded-md flex items-center justify-center shadow-sm hover:shadow-md transition-all"
            title="Zoom Out"
            type="button"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            className="w-10 h-10 bg-white/90 hover:bg-white border border-gray-300 rounded-md flex items-center justify-center shadow-sm hover:shadow-md transition-all"
            title="Reset Zoom"
            type="button"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom indicator */}
        <div 
          className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded text-sm"
          style={{ zIndex: 99999, position: 'fixed' }}
        >
          {Math.round(zoom * 100)}%
        </div>

        {/* Zoomable and pannable container */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isPanning ? 'none' : 'transform 0.2s ease-out'
          }}
        >
          <div className="relative w-full max-w-4xl h-full max-h-[90vh]">
            {/* Your actual SVG as background */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/APERTURE decision tree real - Frame 1.svg" 
              alt="Treatment Decision Tree"
              className="w-full h-full object-contain"
              draggable={false}
              style={{ pointerEvents: isPanning ? 'none' : 'auto' }}
            />
            
            {/* Clickable overlays positioned over each node */}
            <div 
              className="absolute inset-0"
              style={{ pointerEvents: isPanning ? 'none' : 'auto' }}
            >
              {Array.from(nodeAreas.entries()).map(([nodeKey, area]) => {
                const node = nodes.find(n => n.key === nodeKey);
                if (!node) return null;
                
                const state = getNodeState(node);
                
                return (
                  <div
                    key={nodeKey}
                    data-node-key={nodeKey}
                    className={`absolute transition-all duration-300 rounded select-none cursor-pointer ${
                      state === 'unlocked' 
                        ? 'border-3 border-green-500' 
                        : state === 'immediately_unlockable'
                        ? 'border-3 border-yellow-500 bg-yellow-500/15'
                        : 'border-3 border-gray-400 bg-gray-500/20'
                    }`}
                    style={{
                      left: `${area.x}%`,
                      top: `${area.y}%`,
                      width: `${area.width}%`,
                      height: `${area.height}%`,
                      boxShadow: state === 'unlocked' 
                        ? '0 0 10px rgba(34, 197, 94, 0.5), 0 0 20px rgba(34, 197, 94, 0.3)' 
                        : state === 'immediately_unlockable'
                        ? '0 0 10px rgba(234, 179, 8, 0.5), 0 0 20px rgba(234, 179, 8, 0.3)'
                        : '0 0 8px rgba(156, 163, 175, 0.4), 0 0 16px rgba(156, 163, 175, 0.2)',
                    }}
                     onClick={() => {
                       console.log('Node onClick fired for:', nodeKey);
                       if (!isPanning) {
                         handleNodeClick(node);
                       }
                     }}
                     title={node.title}
                    onMouseEnter={(e) => {
                      const target = e.currentTarget as HTMLElement;
                      if (state === 'unlocked') {
                        target.style.boxShadow = '0 0 15px rgba(34, 197, 94, 0.7), 0 0 30px rgba(34, 197, 94, 0.4)';
                      } else if (state === 'immediately_unlockable') {
                        target.style.boxShadow = '0 0 15px rgba(234, 179, 8, 0.7), 0 0 30px rgba(234, 179, 8, 0.4)';
                      } else {
                        target.style.boxShadow = '0 0 12px rgba(156, 163, 175, 0.6), 0 0 24px rgba(156, 163, 175, 0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const target = e.currentTarget as HTMLElement;
                      if (state === 'unlocked') {
                        target.style.boxShadow = '0 0 10px rgba(34, 197, 94, 0.5), 0 0 20px rgba(34, 197, 94, 0.3)';
                      } else if (state === 'immediately_unlockable') {
                        target.style.boxShadow = '0 0 10px rgba(234, 179, 8, 0.5), 0 0 20px rgba(234, 179, 8, 0.3)';
                      } else {
                        target.style.boxShadow = '0 0 8px rgba(156, 163, 175, 0.4), 0 0 16px rgba(156, 163, 175, 0.2)';
                      }
                    }}
                  >
                    {/* Center content - only show locks for locked states */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {state === 'immediately_unlockable' && (
                        <Lock className="w-8 h-8 text-yellow-800 opacity-80" />
                      )}
                      {state === 'locked' && (
                        <Lock className="w-8 h-8 text-gray-700 opacity-75" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full">
      {renderActualSVG()}
      
      {/* Node details popup */}
      <Dialog open={!!selectedNode} onOpenChange={() => setSelectedNode(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedNode && (
            <>
              <DialogHeader className="pr-8">
                <DialogTitle className="text-xl font-semibold">
                  {selectedNode.title}
                </DialogTitle>
                {selectedNode.categories && selectedNode.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedNode.categories.map(category => (
                      <Badge key={category} variant="secondary" className="text-xs">
                        {category.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                )}
              </DialogHeader>
              
              <div className="space-y-4">
                {selectedNode.video_url && (
                  <div className="aspect-video">
                    <VimeoPlayer videoUrl={selectedNode.video_url} />
                  </div>
                )}
                
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

      {/* Unlock prompt */}
      <Dialog open={!!showUnlockPrompt} onOpenChange={() => setShowUnlockPrompt(null)}>
        <DialogContent className="max-w-md">
          {showUnlockPrompt && (
            <>
              <DialogHeader>
                <DialogTitle>Unlock Treatment Step</DialogTitle>
                <DialogDescription>
                  {showUnlockPrompt.edge.description || 
                   `This treatment step can be unlocked now.`}
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex justify-end gap-3 mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => setShowUnlockPrompt(null)}
                >
                  Not now
                </Button>
                <Button 
                  onClick={() => {
                    handleUnlock(showUnlockPrompt.node.id);
                    setShowUnlockPrompt(null);
                  }}
                >
                  Yes, unlock this step
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
