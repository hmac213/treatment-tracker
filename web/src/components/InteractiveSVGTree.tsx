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

type UnlockableChild = {
  childId: string;
  childTitle: string;
  symptoms: string[];
  unlockDescription: string;
  edge: {
    id: string;
    unlock_type: 'always' | 'manual' | 'symptom_match';
    unlock_value: Record<string, unknown> | null;
  };
};

interface InteractiveSVGTreeProps {
  nodes: AppNode[];
  edges: AppEdge[];
  unlockedNodeIds: Set<string>;
  symptomsMap?: Map<string, string>; // symptom key -> label mapping
}

export function InteractiveSVGTree({ nodes, edges, unlockedNodeIds, symptomsMap = new Map() }: InteractiveSVGTreeProps) {
  const [selectedNode, setSelectedNode] = useState<AppNode | null>(null);
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

  // Build unlockable children map for each unlocked node
  const unlockableChildrenMap = new Map<string, UnlockableChild[]>();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  edges.forEach(edge => {
    // Only consider edges from unlocked parents to locked children
    if (unlockedNodeIds.has(edge.parent_id) && !unlockedNodeIds.has(edge.child_id)) {
      const childNode = nodeMap.get(edge.child_id);
      if (childNode) {
        if (!unlockableChildrenMap.has(edge.parent_id)) {
          unlockableChildrenMap.set(edge.parent_id, []);
        }
        
        // Extract symptoms from unlock_value
        const symptoms: string[] = [];
        if (edge.unlock_type === 'symptom_match' && edge.unlock_value) {
          const rule = edge.unlock_value as { any?: string[]; all?: string[] };
          const anySymptoms = rule.any || [];
          const allSymptoms = rule.all || [];
          symptoms.push(...anySymptoms, ...allSymptoms);
        }
        
        // Convert symptom keys to labels
        const symptomLabels = symptoms
          .map(key => symptomsMap.get(key) || key)
          .filter(Boolean);
        
        unlockableChildrenMap.get(edge.parent_id)!.push({
          childId: edge.child_id,
          childTitle: childNode.title,
          symptoms: symptomLabels,
          unlockDescription: edge.description || `Unlock ${childNode.title}`,
          edge: {
            id: edge.id,
            unlock_type: edge.unlock_type,
            unlock_value: edge.unlock_value
          }
        });
      }
    }
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
    }
    // For locked nodes, do nothing - unlocking is now done via symptom buttons
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

  // Positions for symptom diamonds - positioned strategically around nodes
  const symptomPositions = new Map([
    // Calendula -> Silvadene (moist desquamation)
    ['calendula_silvadene', { x: 23.5, y: 45.0 }],
    // Silvadene -> Mepilex (skin high risk)
    ['silvadene_mepilex', { x: 23.5, y: 68.0 }],
    // Eat any -> Liquid diet (weight loss 5%)
    ['eat_any_liquid_diet', { x: 37.5, y: 45.0 }],
    // Liquid diet -> Tube feeding (weight loss 10%)
    ['liquid_diet_tube_feeding', { x: 37.5, y: 68.0 }],
    // Baking 2x -> Baking 4x (mouth pain, increased mucositis)
    ['baking_2x_baking_4x', { x: 66.0, y: 42.0 }],
    // Baking 4x -> MuGard direct (focal oral lesions)
    ['baking_4x_mugard_direct', { x: 66.0, y: 62.0 }],
    // Lidocaine -> Dox/Morph (persistent pain, severe mouth pain)
    ['lidocaine_dox_morph', { x: 79.0, y: 62.0 }],
    // Lidocaine -> Opioid (pain remains, pain worsens)
    ['lidocaine_opioid', { x: 67.0, y: 78.0 }],
    // Opioid -> Nerve pain (pain remains + neck/ear/nerve pain)
    ['opioid_nerve_pain', { x: 54.0, y: 78.0 }],
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

              {/* Symptom diamonds - positioned around unlocked nodes */}
              {Array.from(unlockableChildrenMap.entries()).map(([parentNodeId, unlockableChildren]) => {
                const parentNode = nodeMap.get(parentNodeId);
                if (!parentNode || !unlockedNodeIds.has(parentNodeId)) return null;

                return unlockableChildren.map((unlockableChild) => {
                  // Create a key for the symptom position lookup
                  const positionKey = `${parentNode.key}_${nodeMap.get(unlockableChild.childId)?.key}`;
                  const position = symptomPositions.get(positionKey);
                  
                  if (!position) return null; // Skip if no position defined

                  return (
                    <div key={`${parentNodeId}_${unlockableChild.childId}`}>
                      {unlockableChild.symptoms.map((symptom, index) => (
                        <div
                          key={`${parentNodeId}_${unlockableChild.childId}_${index}`}
                          className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 hover:scale-110 transition-all duration-200"
                          style={{
                            left: `${position.x + (index * 1.5)}%`, // Offset multiple symptoms slightly
                            top: `${position.y + (index * 1.5)}%`,
                            pointerEvents: isPanning ? 'none' : 'auto'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isPanning) {
                              handleUnlock(unlockableChild.childId);
                            }
                          }}
                          title={`${symptom} → Unlock ${unlockableChild.childTitle}`}
                        >
                          {/* Diamond shape */}
                          <div className="relative">
                            <div 
                              className="w-8 h-8 bg-blue-500 hover:bg-blue-600 border-2 border-white shadow-lg transform rotate-45"
                              style={{
                                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4), 0 0 0 2px white'
                              }}
                            />
                            {/* Icon inside diamond */}
                            <div className="absolute inset-0 flex items-center justify-center transform -rotate-45">
                              <Stethoscope className="w-4 h-4 text-white" />
                            </div>
                            {/* Tooltip on hover */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                              {symptom}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                });
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

    </div>
  );
}
