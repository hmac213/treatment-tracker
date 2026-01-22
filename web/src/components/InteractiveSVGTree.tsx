'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VimeoPlayer } from './VimeoPlayer';
import { IntroductionMiniTree } from './IntroductionMiniTree';
import { Lock, ZoomIn, ZoomOut, RotateCcw, Stethoscope, Edit2, Save } from 'lucide-react';

// Type definitions
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

type BranchingPromptInfo = {
  title: string;
  yesEdge: AppEdge;
  noEdge: AppEdge;
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

interface InteractiveSVGTreeProps {
  nodes: AppNode[];
  edges: AppEdge[];
  unlockedNodeIds: Set<string>;
  symptomsMap?: Map<string, string>; // symptom key -> label mapping
  categoryVideos?: Record<string, CategoryVideo[]>; // category -> videos
  categoryPositions?: Record<string, CategoryPosition>; // category -> position
  bonusContentVideos?: Record<string, CategoryVideo[]>; // category -> bonus videos
  bonusContentPositions?: Record<string, CategoryPosition>; // category -> bonus position
  isAdmin?: boolean; // Whether user is admin (enables edit mode)
  onCategoryPositionUpdate?: (category: string, position: CategoryPosition) => void; // Callback for position updates
  onBonusContentPositionUpdate?: (category: string, position: CategoryPosition) => void; // Callback for bonus position updates
  nodePositions?: Record<string, { x: number; y: number; width: number; height: number }>; // node key -> position
  symptomPositions?: Record<string, { x: number; y: number; width: number; height: number }>; // position key -> position
  onNodePositionUpdate?: () => void; // Callback to refresh node positions
  onSymptomPositionUpdate?: () => void; // Callback to refresh symptom positions
}

export function InteractiveSVGTree({ 
  nodes, 
  edges, 
  unlockedNodeIds, 
  symptomsMap = new Map(),
  categoryVideos = {},
  categoryPositions = {},
  bonusContentVideos = {},
  bonusContentPositions = {},
  isAdmin = false,
  onCategoryPositionUpdate,
  onBonusContentPositionUpdate,
  nodePositions: propNodePositions = {},
  symptomPositions: propSymptomPositions = {},
  onNodePositionUpdate,
  onSymptomPositionUpdate,
}: InteractiveSVGTreeProps) {
  // Component State
  const [selectedNode, setSelectedNode] = useState<AppNode | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBonusContent, setSelectedBonusContent] = useState<string | null>(null);
  const [showIntroductionPopup, setShowIntroductionPopup] = useState(false);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState<{ node: AppNode; edge: AppEdge } | null>(null);
  const [showBranchingPrompt, setShowBranchingPrompt] = useState<BranchingPromptInfo | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [editMode, setEditMode] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingBonusContent, setEditingBonusContent] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editingSymptom, setEditingSymptom] = useState<string | null>(null);
  const [tempPositions, setTempPositions] = useState<Record<string, CategoryPosition>>(() => ({ ...categoryPositions }));
  const [tempBonusPositions, setTempBonusPositions] = useState<Record<string, CategoryPosition>>(() => ({ ...bonusContentPositions }));
  const [tempNodePositions, setTempNodePositions] = useState<Record<string, { x: number; y: number; width: number; height: number }>>(() => ({ ...propNodePositions }));
  const [tempSymptomPositions, setTempSymptomPositions] = useState<Record<string, { x: number; y: number; width: number; height: number }>>(() => ({ ...propSymptomPositions }));
  
  // Track previous editMode to detect when exiting edit mode
  const prevEditModeRef = useRef(editMode);
  
  // Update tempPositions when exiting edit mode or when editMode is false and props change
  useEffect(() => {
    const wasInEditMode = prevEditModeRef.current;
    const isExitingEditMode = wasInEditMode && !editMode;
    
    // Only update when exiting edit mode or when not in edit mode (initial load)
    if (isExitingEditMode || (!editMode && !wasInEditMode)) {
      setTempPositions({ ...categoryPositions });
      setTempBonusPositions({ ...bonusContentPositions });
      setTempNodePositions({ ...propNodePositions });
      setTempSymptomPositions({ ...propSymptomPositions });
    }
    
    prevEditModeRef.current = editMode;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode]);
  
  // Save position helper
  const savePosition = async (type: 'node' | 'symptom', key: string, position: { x: number; y: number; width: number; height: number }) => {
    if (!isAdmin) return;
    
    try {
      const response = await fetch('/api/admin/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, key, position }),
      });
      
      if (response.ok) {
        // Update local temp state immediately to prevent reversion
        if (type === 'node') {
          setTempNodePositions(prev => ({
            ...prev,
            [key]: position
          }));
        } else {
          setTempSymptomPositions(prev => ({
            ...prev,
            [key]: position
          }));
        }
        
        // Refresh positions from parent after successful save
        if (type === 'node' && onNodePositionUpdate) {
          onNodePositionUpdate();
        } else if (type === 'symptom' && onSymptomPositionUpdate) {
          onSymptomPositionUpdate();
        }
      } else {
        console.error('Failed to save position');
        alert('Failed to save position');
      }
    } catch (error) {
      console.error('Error saving position:', error);
      alert('Error saving position');
    }
  };
  
  // When entering edit mode, initialize default positions for categories and bonus content that don't have them
  useEffect(() => {
    if (editMode) {
      const categories = ['skincare', 'nutrition', 'oral_care', 'pain'] as const;
      const defaults: Record<string, CategoryPosition> = {
        skincare: { pos_x: 8, pos_y: 22, width: 12, height: 3 },
        nutrition: { pos_x: 28, pos_y: 22, width: 12, height: 3 },
        oral_care: { pos_x: 49, pos_y: 22, width: 12, height: 3 },
        pain: { pos_x: 81, pos_y: 22, width: 12, height: 3 },
      };
      
      setTempPositions(prev => {
        const updated = { ...prev };
        categories.forEach(cat => {
          if (!updated[cat] && !categoryPositions[cat]) {
            updated[cat] = defaults[cat];
          }
        });
        return updated;
      });

      const bonusCategories = ['skincare', 'nutrition', 'oral_care', 'introduction'] as const;
      const bonusDefaults: Record<string, CategoryPosition> = {
        skincare: { pos_x: 8, pos_y: 28, width: 12, height: 3 },
        nutrition: { pos_x: 28, pos_y: 28, width: 12, height: 3 },
        oral_care: { pos_x: 49, pos_y: 28, width: 12, height: 3 },
        introduction: { pos_x: 38.5, pos_y: 2, width: 22.9, height: 3 },
      };
      
      setTempBonusPositions(prev => {
        const updated = { ...prev };
        bonusCategories.forEach(cat => {
          if (!updated[cat] && !bonusContentPositions[cat]) {
            updated[cat] = bonusDefaults[cat];
          }
        });
        return updated;
      });
    }
  }, [editMode, categoryPositions, bonusContentPositions]);
  const containerRef = useRef<HTMLDivElement>(null);
  const wasDragged = useRef(false);
  const categoryBoxRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Use prop positions if available, otherwise fall back to hardcoded defaults
  const defaultSymptomPositions = new Map([
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
  
  // Merge prop positions with defaults
  const symptomPositions = useMemo(() => {
    const map = new Map(defaultSymptomPositions);
    Object.entries(propSymptomPositions).forEach(([key, pos]) => {
      map.set(key, pos);
    });
    return map;
  }, [propSymptomPositions]);

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
  const handleWheel = (e: React.WheelEvent) => { 
    e.preventDefault(); 
    e.stopPropagation(); 
    const delta = e.deltaY > 0 ? 0.9 : 1.1; 
    setZoom(prev => Math.min(Math.max(prev * delta, 0.5), 3)); 
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractiveElement = target.closest('[data-node-key], [data-symptom-diamond], [data-category-box], [data-bonus-content-box], .zoom-controls, .resize-handle');

    if (e.button === 0 && !isInteractiveElement) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
    }
  };
  
  // Generic drag handler for nodes and symptoms
  const handleElementDrag = (
    key: string,
    type: 'node' | 'symptom',
    e: React.MouseEvent,
    currentPos: { x: number; y: number; width: number; height: number }
  ) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    wasDragged.current = false;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    const startX = e.clientX;
    const startY = e.clientY;
    const startPosX = currentPos.x;
    const startPosY = currentPos.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      wasDragged.current = true;
      const deltaX = ((moveEvent.clientX - startX) / containerWidth) * 100;
      const deltaY = ((moveEvent.clientY - startY) / containerHeight) * 100;

      const newX = Math.max(0, Math.min(100 - currentPos.width, startPosX + deltaX));
      const newY = Math.max(0, Math.min(100 - currentPos.height, startPosY + deltaY));

      if (type === 'node') {
        setTempNodePositions(prev => ({
          ...prev,
          [key]: { ...currentPos, x: newX, y: newY }
        }));
      } else {
        setTempSymptomPositions(prev => ({
          ...prev,
          [key]: { ...currentPos, x: newX, y: newY }
        }));
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setTimeout(() => { wasDragged.current = false; }, 0);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  // Generic resize handler for nodes and symptoms
  const handleElementResize = (
    key: string,
    type: 'node' | 'symptom',
    e: React.MouseEvent,
    handle: 'se' | 'sw' | 'ne' | 'nw' | 'e' | 'w' | 'n' | 's',
    currentPos: { x: number; y: number; width: number; height: number }
  ) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    wasDragged.current = false;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    const startX = e.clientX;
    const startY = e.clientY;
    const startPosX = currentPos.x;
    const startPosY = currentPos.y;
    const startWidth = currentPos.width;
    const startHeight = currentPos.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      wasDragged.current = true;
      const deltaX = ((moveEvent.clientX - startX) / containerWidth) * 100;
      const deltaY = ((moveEvent.clientY - startY) / containerHeight) * 100;

      let newX = startPosX;
      let newY = startPosY;
      let newWidth = startWidth;
      let newHeight = startHeight;

      if (handle.includes('e')) {
        newWidth = Math.max(2, Math.min(100 - startPosX, startWidth + deltaX));
      }
      if (handle.includes('w')) {
        const widthChange = -deltaX;
        newWidth = Math.max(2, Math.min(startPosX + startWidth, startWidth + widthChange));
        newX = Math.max(0, Math.min(startPosX + startWidth - 2, startPosX + deltaX));
      }
      if (handle.includes('s')) {
        newHeight = Math.max(2, Math.min(100 - startPosY, startHeight + deltaY));
      }
      if (handle.includes('n')) {
        const heightChange = -deltaY;
        newHeight = Math.max(2, Math.min(startPosY + startHeight, startHeight + heightChange));
        newY = Math.max(0, Math.min(startPosY + startHeight - 2, startPosY + deltaY));
      }

      if (newX + newWidth > 100) newWidth = 100 - newX;
      if (newY + newHeight > 100) newHeight = 100 - newY;

      const newPos = { x: newX, y: newY, width: newWidth, height: newHeight };
      if (type === 'node') {
        setTempNodePositions(prev => ({ ...prev, [key]: newPos }));
      } else {
        setTempSymptomPositions(prev => ({ ...prev, [key]: newPos }));
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setTimeout(() => { wasDragged.current = false; }, 0);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleCategoryClick = (category: string) => {
    if (editMode && editingCategory === category) {
      // Save position
      const positionToSave = tempPositions[category] || categoryPositions[category];
      if (onCategoryPositionUpdate && positionToSave) {
        onCategoryPositionUpdate(category, positionToSave);
      }
      setEditingCategory(null);
    } else if (editMode) {
      // Enter edit mode for this category
      setEditingCategory(category);
      // Initialize temp position if it doesn't exist
      if (!tempPositions[category] && !categoryPositions[category]) {
        setTempPositions(prev => ({
          ...prev,
          [category]: { pos_x: 20, pos_y: 20, width: 10, height: 5 }
        }));
      }
    } else {
      // Show category videos
      if (categoryVideos[category] && categoryVideos[category].length > 0) {
        setSelectedCategory(category);
      }
    }
  };

  const handleBonusContentClick = (category: string) => {
    if (editMode && editingBonusContent === category) {
      // Save position
      const positionToSave = tempBonusPositions[category] || bonusContentPositions[category];
      if (onBonusContentPositionUpdate && positionToSave) {
        onBonusContentPositionUpdate(category, positionToSave);
      }
      setEditingBonusContent(null);
    } else if (editMode) {
      // Enter edit mode for this bonus content
      setEditingBonusContent(category);
      // Initialize temp position if it doesn't exist
      if (!tempBonusPositions[category] && !bonusContentPositions[category]) {
        setTempBonusPositions(prev => ({
          ...prev,
          [category]: { pos_x: 20, pos_y: 20, width: 10, height: 5 }
        }));
      }
    } else {
      // Special handling for introduction - show popup
      if (category === 'introduction') {
        setShowIntroductionPopup(true);
      } else {
        // Show bonus content videos
        if (bonusContentVideos[category] && bonusContentVideos[category].length > 0) {
          setSelectedBonusContent(category);
        }
      }
    }
  };

  const handleCategoryBoxDrag = (category: string, e: React.MouseEvent) => {
    if (!editMode || editingCategory !== category) return;
    e.preventDefault();
    e.stopPropagation();
    wasDragged.current = false;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = tempPositions[category] || categoryPositions[category] || { pos_x: 20, pos_y: 20, width: 10, height: 5 };
    const startPosX = startPos.pos_x;
    const startPosY = startPos.pos_y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      wasDragged.current = true;
      
      // Calculate the delta in percentage of container
      const deltaX = ((moveEvent.clientX - startX) / containerWidth) * 100;
      const deltaY = ((moveEvent.clientY - startY) / containerHeight) * 100;

      const newX = Math.max(0, Math.min(100 - startPos.width, startPosX + deltaX));
      const newY = Math.max(0, Math.min(100 - startPos.height, startPosY + deltaY));

      setTempPositions(prev => ({
        ...prev,
        [category]: {
          ...startPos,
          pos_x: newX,
          pos_y: newY,
        }
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setTimeout(() => { wasDragged.current = false; }, 0);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleCategoryBoxResize = (category: string, e: React.MouseEvent, handle: 'se' | 'sw' | 'ne' | 'nw' | 'e' | 'w' | 'n' | 's') => {
    if (!editMode || editingCategory !== category) return;
    e.preventDefault();
    e.stopPropagation();
    wasDragged.current = false;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = tempPositions[category] || categoryPositions[category] || { pos_x: 20, pos_y: 20, width: 10, height: 5 };
    const startPosX = startPos.pos_x;
    const startPosY = startPos.pos_y;
    const startWidth = startPos.width;
    const startHeight = startPos.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      wasDragged.current = true;
      
      // Calculate the delta in percentage of container
      const deltaX = ((moveEvent.clientX - startX) / containerWidth) * 100;
      const deltaY = ((moveEvent.clientY - startY) / containerHeight) * 100;

      let newX = startPosX;
      let newY = startPosY;
      let newWidth = startWidth;
      let newHeight = startHeight;

      // Handle different resize handles
      if (handle.includes('e')) {
        // Resize from right edge
        newWidth = Math.max(2, Math.min(100 - startPosX, startWidth + deltaX));
      }
      if (handle.includes('w')) {
        // Resize from left edge
        const widthChange = -deltaX;
        newWidth = Math.max(2, Math.min(startPosX + startWidth, startWidth + widthChange));
        newX = Math.max(0, Math.min(startPosX + startWidth - 2, startPosX + deltaX));
      }
      if (handle.includes('s')) {
        // Resize from bottom edge
        newHeight = Math.max(2, Math.min(100 - startPosY, startHeight + deltaY));
      }
      if (handle.includes('n')) {
        // Resize from top edge
        const heightChange = -deltaY;
        newHeight = Math.max(2, Math.min(startPosY + startHeight, startHeight + heightChange));
        newY = Math.max(0, Math.min(startPosY + startHeight - 2, startPosY + deltaY));
      }

      // Ensure box stays within bounds
      if (newX + newWidth > 100) {
        newWidth = 100 - newX;
      }
      if (newY + newHeight > 100) {
        newHeight = 100 - newY;
      }

      setTempPositions(prev => ({
        ...prev,
        [category]: {
          pos_x: newX,
          pos_y: newY,
          width: newWidth,
          height: newHeight,
        }
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setTimeout(() => { wasDragged.current = false; }, 0);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleBonusContentBoxDrag = (category: string, e: React.MouseEvent) => {
    if (!editMode || editingBonusContent !== category) return;
    e.preventDefault();
    e.stopPropagation();
    wasDragged.current = false;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = tempBonusPositions[category] || bonusContentPositions[category] || { pos_x: 20, pos_y: 20, width: 10, height: 5 };
    const startPosX = startPos.pos_x;
    const startPosY = startPos.pos_y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      wasDragged.current = true;
      
      // Calculate the delta in percentage of container
      const deltaX = ((moveEvent.clientX - startX) / containerWidth) * 100;
      const deltaY = ((moveEvent.clientY - startY) / containerHeight) * 100;

      const newX = Math.max(0, Math.min(100 - startPos.width, startPosX + deltaX));
      const newY = Math.max(0, Math.min(100 - startPos.height, startPosY + deltaY));

      setTempBonusPositions(prev => ({
        ...prev,
        [category]: {
          ...startPos,
          pos_x: newX,
          pos_y: newY,
        }
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setTimeout(() => { wasDragged.current = false; }, 0);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleBonusContentBoxResize = (category: string, e: React.MouseEvent, handle: 'se' | 'sw' | 'ne' | 'nw' | 'e' | 'w' | 'n' | 's') => {
    if (!editMode || editingBonusContent !== category) return;
    e.preventDefault();
    e.stopPropagation();
    wasDragged.current = false;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = tempBonusPositions[category] || bonusContentPositions[category] || { pos_x: 20, pos_y: 20, width: 10, height: 5 };
    const startPosX = startPos.pos_x;
    const startPosY = startPos.pos_y;
    const startWidth = startPos.width;
    const startHeight = startPos.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      wasDragged.current = true;
      
      // Calculate the delta in percentage of container
      const deltaX = ((moveEvent.clientX - startX) / containerWidth) * 100;
      const deltaY = ((moveEvent.clientY - startY) / containerHeight) * 100;

      let newX = startPosX;
      let newY = startPosY;
      let newWidth = startWidth;
      let newHeight = startHeight;

      // Handle different resize handles
      if (handle.includes('e')) {
        // Resize from right edge
        newWidth = Math.max(2, Math.min(100 - startPosX, startWidth + deltaX));
      }
      if (handle.includes('w')) {
        // Resize from left edge
        const widthChange = -deltaX;
        newWidth = Math.max(2, Math.min(startPosX + startWidth, startWidth + widthChange));
        newX = Math.max(0, Math.min(startPosX + startWidth - 2, startPosX + deltaX));
      }
      if (handle.includes('s')) {
        // Resize from bottom edge
        newHeight = Math.max(2, Math.min(100 - startPosY, startHeight + deltaY));
      }
      if (handle.includes('n')) {
        // Resize from top edge
        const heightChange = -deltaY;
        newHeight = Math.max(2, Math.min(startPosY + startHeight, startHeight + heightChange));
        newY = Math.max(0, Math.min(startPosY + startHeight - 2, startPosY + deltaY));
      }

      // Ensure box stays within bounds
      if (newX + newWidth > 100) {
        newWidth = 100 - newX;
      }
      if (newY + newHeight > 100) {
        newHeight = 100 - newY;
      }

      setTempBonusPositions(prev => ({
        ...prev,
        [category]: {
          pos_x: newX,
          pos_y: newY,
          width: newWidth,
          height: newHeight,
        }
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setTimeout(() => { wasDragged.current = false; }, 0);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
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
  
  // Default node areas - use prop positions if available
  const defaultNodeAreas = new Map([
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
  
  const nodeAreas = useMemo(() => {
    const map = new Map(defaultNodeAreas);
    Object.entries(propNodePositions).forEach(([key, pos]) => {
      map.set(key, { x: pos.x, y: pos.y, width: pos.width, height: pos.height });
    });
    return map;
  }, [propNodePositions]);

  // Render method
  const renderActualSVG = () => (
    <div className="relative w-full h-screen overflow-hidden" onWheel={handleWheel} onWheelCapture={(e) => { e.preventDefault(); e.stopPropagation(); }} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} style={{ cursor: isPanning ? 'grabbing' : 'grab' }}>
      {/* UI Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 zoom-controls" style={{ pointerEvents: 'auto', zIndex: 99999 }}>
        {isAdmin && (
          <Button 
            size="icon" 
            variant={editMode ? "default" : "outline"} 
            title={editMode ? "Exit Edit Mode" : "Edit All Positions"}
            onClick={() => {
              if (editMode) {
                setEditMode(false);
                setEditingCategory(null);
                setEditingBonusContent(null);
                setEditingNode(null);
                setEditingSymptom(null);
                setTempPositions({ ...categoryPositions });
                setTempBonusPositions({ ...bonusContentPositions });
                setTempNodePositions({ ...propNodePositions });
                setTempSymptomPositions({ ...propSymptomPositions });
              } else {
                setEditMode(true);
              }
            }}
          >
            {editMode ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
          </Button>
        )}
        <Button size="icon" variant="outline" title="Zoom In" onClick={() => setZoom(z => Math.min(z * 1.2, 3))}><ZoomIn className="w-4 h-4" /></Button>
        <Button size="icon" variant="outline" title="Zoom Out" onClick={() => setZoom(z => Math.max(z / 1.2, 0.5))}><ZoomOut className="w-4 h-4" /></Button>
        <Button size="icon" variant="outline" title="Reset Zoom" onClick={() => { setZoom(1); setPanX(0); setPanY(0); }}><RotateCcw className="w-4 h-4" /></Button>
      </div>
      <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded text-sm" style={{ zIndex: 99999 }}>
        {Math.round(zoom * 100)}%
        {editMode && <span className="ml-2 text-yellow-400">EDIT MODE</span>}
      </div>

      {/* Pannable/Zoomable container */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, transformOrigin: 'center center', transition: isPanning ? 'none' : 'transform 0.2s ease-out' }}>
        <div ref={containerRef} className="relative w-full max-w-6xl" style={{ aspectRatio: '2505 / 2174' }}>
          <img src="/APERTURE decision tree real - Frame 1 - V2.svg" alt="Treatment Decision Tree" className="w-full h-full" draggable={false} style={{ pointerEvents: 'auto' }} />
          
          <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
            {/* Clickable Node Areas */}
            {Array.from(nodeAreas.entries()).map(([nodeKey, defaultArea]) => {
              const node = nodes.find(n => n.key === nodeKey);
              if (!node) return null;
              
              // Use temp position if editing, otherwise use saved or default
              const tempPos = tempNodePositions[nodeKey];
              const area = editMode && tempPos 
                ? { x: tempPos.x, y: tempPos.y, width: tempPos.width, height: tempPos.height }
                : defaultArea;
              
              const isEditing = editMode && editingNode === nodeKey;
              const state = getNodeState(node);
              
              return (
                <div 
                  key={nodeKey} 
                  data-node-key={nodeKey}
                  className={`absolute transition-all duration-300 rounded select-none ${
                    isEditing 
                      ? 'border-2 border-yellow-500 bg-yellow-500/20 cursor-move' 
                      : editMode
                        ? 'border-2 border-blue-400 bg-blue-400/20 cursor-pointer'
                        : state === 'unlocked' 
                          ? 'border-3 border-green-500 cursor-pointer' 
                          : 'border-3 border-gray-400 bg-gray-500/20'
                  }`}
                  style={{ 
                    left: `${area.x}%`, 
                    top: `${area.y}%`, 
                    width: `${area.width}%`, 
                    height: `${area.height}%`, 
                    pointerEvents: 'auto',
                    zIndex: isEditing ? 100 : 5,
                  }}
                  onMouseDown={(e) => {
                    if (isEditing && e.button === 0 && !(e.target as HTMLElement).classList.contains('resize-handle')) {
                      handleElementDrag(nodeKey, 'node', e, { x: area.x, y: area.y, width: area.width, height: area.height });
                    }
                  }}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
                    e.stopPropagation();
                    if (editMode) {
                      if (isEditing) {
                        // Save position
                        const posToSave = tempNodePositions[nodeKey] || { x: area.x, y: area.y, width: area.width, height: area.height };
                        savePosition('node', nodeKey, posToSave);
                        setEditingNode(null);
                      } else {
                        // Enter edit mode
                        setEditingNode(nodeKey);
                        if (!tempNodePositions[nodeKey]) {
                          setTempNodePositions(prev => ({
                            ...prev,
                            [nodeKey]: { x: area.x, y: area.y, width: area.width, height: area.height }
                          }));
                        }
                      }
                    } else if (!wasDragged.current && state === 'unlocked') {
                      handleNodeClick(node);
                    }
                  }}
                >
                  {isEditing && (
                    <>
                      <div className="absolute -top-6 left-0 bg-yellow-500 text-black text-xs px-2 py-1 rounded whitespace-nowrap z-50">
                        Editing {node.title}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const posToSave = tempNodePositions[nodeKey] || { x: area.x, y: area.y, width: area.width, height: area.height };
                          savePosition('node', nodeKey, posToSave);
                          setEditingNode(null);
                        }}
                        className="absolute -top-6 right-0 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded z-50 flex items-center gap-1"
                      >
                        <Save className="w-3 h-3" />
                        Save
                      </button>
                      {/* Resize handles - same as category boxes */}
                      <div className="resize-handle absolute -top-1 -left-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nwse-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(nodeKey, 'node', e, 'nw', { x: area.x, y: area.y, width: area.width, height: area.height }); }} />
                      <div className="resize-handle absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nesw-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(nodeKey, 'node', e, 'ne', { x: area.x, y: area.y, width: area.width, height: area.height }); }} />
                      <div className="resize-handle absolute -bottom-1 -left-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nesw-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(nodeKey, 'node', e, 'sw', { x: area.x, y: area.y, width: area.width, height: area.height }); }} />
                      <div className="resize-handle absolute -bottom-1 -right-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nwse-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(nodeKey, 'node', e, 'se', { x: area.x, y: area.y, width: area.width, height: area.height }); }} />
                      <div className="resize-handle absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-yellow-500 border border-yellow-700 cursor-ns-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(nodeKey, 'node', e, 'n', { x: area.x, y: area.y, width: area.width, height: area.height }); }} />
                      <div className="resize-handle absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-yellow-500 border border-yellow-700 cursor-ns-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(nodeKey, 'node', e, 's', { x: area.x, y: area.y, width: area.width, height: area.height }); }} />
                      <div className="resize-handle absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-3 bg-yellow-500 border border-yellow-700 cursor-ew-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(nodeKey, 'node', e, 'w', { x: area.x, y: area.y, width: area.width, height: area.height }); }} />
                      <div className="resize-handle absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-3 bg-yellow-500 border border-yellow-700 cursor-ew-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(nodeKey, 'node', e, 'e', { x: area.x, y: area.y, width: area.width, height: area.height }); }} />
                    </>
                  )}
                  {editMode && !isEditing && (
                    <div className="absolute -top-6 left-0 bg-blue-400 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50">
                      {node.title} - Click to edit
                    </div>
                  )}
                  {state === 'locked' && !editMode && <div className="absolute inset-0 flex items-center justify-center"><Lock className="w-8 h-8 text-gray-700 opacity-75" /></div>}
                </div>
              );
            })}

            {/* Symptom Diamonds */}
            {edges.map(edge => {
              const parentNode = nodeMap.get(edge.parent_id);
              const childNode = nodeMap.get(edge.child_id);
              if (!parentNode || !childNode) return null;
              
              const positionKey = `${parentNode.key}_${childNode.key}`;
              const defaultPosition = symptomPositions.get(positionKey);
              if (!defaultPosition) return null;

              const isActuallyUnlockable = unlockedNodeIds.has(edge.parent_id) && !unlockedNodeIds.has(edge.child_id);
              
              // In patient view (non-admin), only show unlockable diamonds
              // In admin/edit mode, show all diamonds for editing
              if (!isAdmin && !isActuallyUnlockable) return null;

              // Use temp position if editing, otherwise use saved or default
              const tempPos = tempSymptomPositions[positionKey];
              const position = editMode && tempPos 
                ? tempPos
                : defaultPosition;

              const isEditing = editMode && editingSymptom === positionKey;
              
              return (
                <div 
                  key={positionKey} 
                  data-symptom-diamond="true" 
                  title={positionKey}
                  className={`absolute z-10 ${
                    isEditing 
                      ? 'cursor-move' 
                      : editMode 
                        ? 'cursor-pointer' 
                        : isActuallyUnlockable 
                          ? 'cursor-pointer' 
                          : 'cursor-default opacity-50'
                  }`}
                  style={{ 
                    left: `${position.x}%`, 
                    top: `${position.y}%`, 
                    width: `${position.width}%`, 
                    height: `${position.height}%`, 
                    transform: 'translate(-50%, -50%)', 
                    pointerEvents: 'auto',
                    zIndex: isEditing ? 100 : 10,
                  }}
                  onMouseDown={(e) => {
                    if (isEditing && e.button === 0 && !(e.target as HTMLElement).classList.contains('resize-handle')) {
                      handleElementDrag(positionKey, 'symptom', e, position);
                    }
                  }}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
                    e.stopPropagation();
                    if (editMode) {
                      if (isEditing) {
                        // Save position
                        const posToSave = tempSymptomPositions[positionKey] || position;
                        savePosition('symptom', positionKey, posToSave);
                        setEditingSymptom(null);
                      } else {
                        // Enter edit mode
                        setEditingSymptom(positionKey);
                        if (!tempSymptomPositions[positionKey]) {
                          setTempSymptomPositions(prev => ({
                            ...prev,
                            [positionKey]: position
                          }));
                        }
                      }
                    } else if (!wasDragged.current && isActuallyUnlockable) {
                      setShowUnlockPrompt({ node: childNode, edge });
                    }
                  }}
                >
                  <div className={`relative w-full h-full group ${isEditing ? 'opacity-100' : ''}`}>
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                      <polygon 
                        points="50,0 100,50 50,100 0,50" 
                        className={`fill-transparent transition-colors ${
                          isEditing 
                            ? 'stroke-yellow-500' 
                            : editMode 
                              ? 'stroke-blue-400' 
                              : 'stroke-blue-500 group-hover:stroke-blue-600'
                        }`} 
                        strokeWidth="8" 
                        vectorEffect="non-scaling-stroke" 
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Stethoscope className={`w-1/3 h-1/3 transition-colors ${
                        isEditing 
                          ? 'text-yellow-500' 
                          : editMode 
                            ? 'text-blue-400' 
                            : 'text-blue-500 group-hover:text-blue-600'
                      }`} />
                    </div>
                  </div>
                  {isEditing && (
                    <>
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs px-2 py-1 rounded whitespace-nowrap z-50">
                        Editing {positionKey}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const posToSave = tempSymptomPositions[positionKey] || position;
                          savePosition('symptom', positionKey, posToSave);
                          setEditingSymptom(null);
                        }}
                        className="absolute -top-6 right-0 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded z-50 flex items-center gap-1"
                      >
                        <Save className="w-3 h-3" />
                        Save
                      </button>
                      {/* Resize handles */}
                      <div className="resize-handle absolute -top-1 -left-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nwse-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(positionKey, 'symptom', e, 'nw', position); }} />
                      <div className="resize-handle absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nesw-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(positionKey, 'symptom', e, 'ne', position); }} />
                      <div className="resize-handle absolute -bottom-1 -left-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nesw-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(positionKey, 'symptom', e, 'sw', position); }} />
                      <div className="resize-handle absolute -bottom-1 -right-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nwse-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(positionKey, 'symptom', e, 'se', position); }} />
                      <div className="resize-handle absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-yellow-500 border border-yellow-700 cursor-ns-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(positionKey, 'symptom', e, 'n', position); }} />
                      <div className="resize-handle absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-yellow-500 border border-yellow-700 cursor-ns-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(positionKey, 'symptom', e, 's', position); }} />
                      <div className="resize-handle absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-3 bg-yellow-500 border border-yellow-700 cursor-ew-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(positionKey, 'symptom', e, 'w', position); }} />
                      <div className="resize-handle absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-3 bg-yellow-500 border border-yellow-700 cursor-ew-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(positionKey, 'symptom', e, 'e', position); }} />
                    </>
                  )}
                  {editMode && !isEditing && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-400 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50">
                      {positionKey} - Click to edit
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Special Branching Diamond */}
            {(() => {
              const branch = branchingEdges.get('dox_morph_branch');
              if (!branch || !branch.yes || !branch.no) return null;
              
              const positionKey = 'dox_morph_branch';
              const defaultPosition = symptomPositions.get(positionKey);
              if (!defaultPosition) return null;

              const isActuallyUnlockable = unlockedNodeIds.has(branch.yes.parent_id) && (!unlockedNodeIds.has(branch.yes.child_id) || !unlockedNodeIds.has(branch.no.child_id));
              
              // In patient view (non-admin), only show unlockable diamonds
              // In admin/edit mode, show all diamonds for editing
              if (!isAdmin && !isActuallyUnlockable) return null;

              // Use temp position if editing, otherwise use saved or default
              const tempPos = tempSymptomPositions[positionKey];
              const position = editMode && tempPos 
                ? tempPos
                : defaultPosition;

              const isEditing = editMode && editingSymptom === positionKey;
              
              return (
                  <div 
                    data-symptom-diamond="true" 
                    title="Pain in the Neck, Ear, or Nerves?"
                    className={`absolute z-10 ${
                      isEditing 
                        ? 'cursor-move' 
                        : editMode 
                          ? 'cursor-pointer' 
                          : isActuallyUnlockable 
                            ? 'cursor-pointer' 
                            : 'cursor-default opacity-50'
                    }`}
                    style={{ 
                      left: `${position.x}%`, 
                      top: `${position.y}%`, 
                      width: `${position.width}%`, 
                      height: `${position.height}%`, 
                      transform: 'translate(-50%, -50%)', 
                      pointerEvents: 'auto',
                      zIndex: isEditing ? 100 : 10,
                    }}
                    onMouseDown={(e) => {
                      if (isEditing && e.button === 0 && !(e.target as HTMLElement).classList.contains('resize-handle')) {
                        handleElementDrag(positionKey, 'symptom', e, position);
                      }
                    }}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
                      e.stopPropagation();
                      if (editMode) {
                        if (isEditing) {
                          // Save position
                          const posToSave = tempSymptomPositions[positionKey] || position;
                          savePosition('symptom', positionKey, posToSave);
                          setEditingSymptom(null);
                        } else {
                          // Enter edit mode
                          setEditingSymptom(positionKey);
                          if (!tempSymptomPositions[positionKey]) {
                            setTempSymptomPositions(prev => ({
                              ...prev,
                              [positionKey]: position
                            }));
                          }
                        }
                      } else if (!wasDragged.current && isActuallyUnlockable) {
                        setShowBranchingPrompt({ title: "Pain in the Neck, Ear, or Nerves?", yesEdge: branch.yes!, noEdge: branch.no! });
                      }
                    }}
                  >
                      <div className={`relative w-full h-full group ${isEditing ? 'opacity-100' : ''}`}>
                          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                            <polygon 
                              points="50,0 100,50 50,100 0,50" 
                              className={`fill-transparent transition-colors ${
                                isEditing 
                                  ? 'stroke-yellow-500' 
                                  : editMode 
                                    ? 'stroke-blue-400' 
                                    : 'stroke-blue-500 group-hover:stroke-blue-600'
                              }`} 
                              strokeWidth="8" 
                              vectorEffect="non-scaling-stroke" 
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Stethoscope className={`w-1/3 h-1/3 transition-colors ${
                              isEditing 
                                ? 'text-yellow-500' 
                                : editMode 
                                  ? 'text-blue-400' 
                                  : 'text-blue-500 group-hover:text-blue-600'
                            }`} />
                          </div>
                      </div>
                      {isEditing && (
                        <>
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs px-2 py-1 rounded whitespace-nowrap z-50">
                            Editing branching prompt
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const posToSave = tempSymptomPositions[positionKey] || position;
                              savePosition('symptom', positionKey, posToSave);
                              setEditingSymptom(null);
                            }}
                            className="absolute -top-6 right-0 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded z-50 flex items-center gap-1"
                          >
                            <Save className="w-3 h-3" />
                            Save
                          </button>
                          {/* Resize handles */}
                          <div className="resize-handle absolute -top-1 -left-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nwse-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(positionKey, 'symptom', e, 'nw', position); }} />
                          <div className="resize-handle absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nesw-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(positionKey, 'symptom', e, 'ne', position); }} />
                          <div className="resize-handle absolute -bottom-1 -left-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nesw-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(positionKey, 'symptom', e, 'sw', position); }} />
                          <div className="resize-handle absolute -bottom-1 -right-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nwse-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(positionKey, 'symptom', e, 'se', position); }} />
                          <div className="resize-handle absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-yellow-500 border border-yellow-700 cursor-ns-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(positionKey, 'symptom', e, 'n', position); }} />
                          <div className="resize-handle absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-yellow-500 border border-yellow-700 cursor-ns-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(positionKey, 'symptom', e, 's', position); }} />
                          <div className="resize-handle absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-3 bg-yellow-500 border border-yellow-700 cursor-ew-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(positionKey, 'symptom', e, 'w', position); }} />
                          <div className="resize-handle absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-3 bg-yellow-500 border border-yellow-700 cursor-ew-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleElementResize(positionKey, 'symptom', e, 'e', position); }} />
                        </>
                      )}
                      {editMode && !isEditing && (
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-400 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50">
                          Branching prompt - Click to edit
                        </div>
                      )}
                  </div>
              );
            })()}

            {/* Category Video Boxes */}
            {(['skincare', 'nutrition', 'oral_care', 'pain'] as const).map(category => {
              // Use temp position if editing, otherwise use saved position, or default position if in edit mode
              const savedPosition = categoryPositions[category];
              const defaultPosition = { pos_x: 20, pos_y: 20, width: 10, height: 5 };
              
              // In edit mode, always show boxes (use temp, saved, or default)
              // Outside edit mode, only show if we have a saved position
              let position: CategoryPosition | null = null;
              if (editMode) {
                position = tempPositions[category] || savedPosition || defaultPosition;
              } else {
                position = savedPosition || null;
              }
              
              if (!position) return null;

              const isEditing = editMode && editingCategory === category;
              const hasVideos = categoryVideos[category] && categoryVideos[category].length > 0;

              return (
                <div
                  key={category}
                  data-category-box={category}
                  ref={(el) => { categoryBoxRefs.current[category] = el; }}
                  className={`absolute transition-all duration-200 rounded select-none ${
                    isEditing 
                      ? 'border-2 border-yellow-500 bg-yellow-500/20 cursor-move' 
                      : editMode
                        ? 'border-2 border-blue-400 bg-blue-400/20 cursor-pointer hover:bg-blue-400/30'
                        : hasVideos 
                          ? 'border-2 border-purple-500 bg-purple-500/20 cursor-pointer hover:bg-purple-500/30' 
                          : 'border-2 border-gray-400 bg-gray-400/20'
                  }`}
                  style={{
                    left: `${position.pos_x}%`,
                    top: `${position.pos_y}%`,
                    width: `${position.width}%`,
                    height: `${position.height}%`,
                    pointerEvents: 'auto',
                    zIndex: isEditing ? 100 : 5,
                  }}
                  onMouseDown={(e) => {
                    // Don't start drag if clicking on a resize handle
                    if (isEditing && e.button === 0 && !(e.target as HTMLElement).classList.contains('resize-handle')) {
                      handleCategoryBoxDrag(category, e);
                    }
                  }}
                  onClick={(e) => {
                    // Don't trigger click if clicking on a resize handle
                    if ((e.target as HTMLElement).classList.contains('resize-handle')) {
                      return;
                    }
                    e.stopPropagation();
                    if (!wasDragged.current) {
                      handleCategoryClick(category);
                    }
                  }}
                  title={editMode ? (isEditing ? `Editing ${category} position. Drag to move, drag corners/edges to resize, click to save.` : `Click to edit ${category} position`) : `${category} videos`}
                >
                  {isEditing && (
                    <>
                      <div className="absolute -top-6 left-0 bg-yellow-500 text-black text-xs px-2 py-1 rounded whitespace-nowrap z-50">
                        Editing {category} - Drag to move, resize handles to resize
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const positionToSave = tempPositions[category] || categoryPositions[category];
                          if (onCategoryPositionUpdate && positionToSave) {
                            onCategoryPositionUpdate(category, positionToSave);
                          }
                          setEditingCategory(null);
                        }}
                        className="absolute -top-6 right-0 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded z-50 flex items-center gap-1"
                        title="Save position and size"
                      >
                        <Save className="w-3 h-3" />
                        Save
                      </button>
                      {/* Resize handles */}
                      {/* Corner handles */}
                      <div 
                        className="resize-handle absolute -top-1 -left-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nwse-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleCategoryBoxResize(category, e, 'nw');
                        }}
                      />
                      <div 
                        className="resize-handle absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nesw-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleCategoryBoxResize(category, e, 'ne');
                        }}
                      />
                      <div 
                        className="resize-handle absolute -bottom-1 -left-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nesw-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleCategoryBoxResize(category, e, 'sw');
                        }}
                      />
                      <div 
                        className="resize-handle absolute -bottom-1 -right-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nwse-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleCategoryBoxResize(category, e, 'se');
                        }}
                      />
                      {/* Edge handles */}
                      <div 
                        className="resize-handle absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-yellow-500 border border-yellow-700 cursor-ns-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleCategoryBoxResize(category, e, 'n');
                        }}
                      />
                      <div 
                        className="resize-handle absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-yellow-500 border border-yellow-700 cursor-ns-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleCategoryBoxResize(category, e, 's');
                        }}
                      />
                      <div 
                        className="resize-handle absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-3 bg-yellow-500 border border-yellow-700 cursor-ew-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleCategoryBoxResize(category, e, 'w');
                        }}
                      />
                      <div 
                        className="resize-handle absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-3 bg-yellow-500 border border-yellow-700 cursor-ew-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleCategoryBoxResize(category, e, 'e');
                        }}
                      />
                    </>
                  )}
                  {editMode && !isEditing && (
                    <div className="absolute -top-6 left-0 bg-blue-400 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50">
                      {category} - Click to edit
                    </div>
                  )}
                </div>
              );
            })}

            {/* Bonus Content Boxes */}
            {(['skincare', 'nutrition', 'oral_care', 'introduction'] as const).map(category => {
              // Use temp position if editing, otherwise use saved position, or default position if in edit mode
              const savedPosition = bonusContentPositions[category];
              const defaultPosition = { pos_x: 20, pos_y: 30, width: 10, height: 5 };
              
              // In edit mode, always show boxes (use temp, saved, or default)
              // Outside edit mode, only show if we have a saved position
              let position: CategoryPosition | null = null;
              if (editMode) {
                position = tempBonusPositions[category] || savedPosition || defaultPosition;
              } else {
                position = savedPosition || null;
              }
              
              if (!position) return null;

              const isEditing = editMode && editingBonusContent === category;
              const hasVideos = category !== 'introduction' && bonusContentVideos[category] && bonusContentVideos[category].length > 0;

              return (
                <div
                  key={`bonus-${category}`}
                  data-bonus-content-box={category}
                  className={`absolute transition-all duration-200 rounded select-none ${
                    isEditing 
                      ? 'border-2 border-yellow-500 bg-yellow-500/20 cursor-move' 
                      : editMode
                        ? 'border-2 border-orange-400 bg-orange-400/20 cursor-pointer hover:bg-orange-400/30'
                        : hasVideos || category === 'introduction'
                          ? 'border-2 border-orange-500 bg-orange-500/20 cursor-pointer hover:bg-orange-500/30' 
                          : 'border-2 border-gray-400 bg-gray-400/20'
                  }`}
                  style={{
                    left: `${position.pos_x}%`,
                    top: `${position.pos_y}%`,
                    width: `${position.width}%`,
                    height: `${position.height}%`,
                    pointerEvents: 'auto',
                    zIndex: isEditing ? 100 : 5,
                  }}
                  onMouseDown={(e) => {
                    // Don't start drag if clicking on a resize handle
                    if (isEditing && e.button === 0 && !(e.target as HTMLElement).classList.contains('resize-handle')) {
                      handleBonusContentBoxDrag(category, e);
                    }
                  }}
                  onClick={(e) => {
                    // Don't trigger click if clicking on a resize handle
                    if ((e.target as HTMLElement).classList.contains('resize-handle')) {
                      return;
                    }
                    e.stopPropagation();
                    if (!wasDragged.current) {
                      handleBonusContentClick(category);
                    }
                  }}
                  title={editMode ? (isEditing ? `Editing ${category} bonus content position. Drag to move, drag corners/edges to resize, click to save.` : `Click to edit ${category} bonus content position`) : `${category} bonus content`}
                >
                  {isEditing && (
                    <>
                      <div className="absolute -top-6 left-0 bg-yellow-500 text-black text-xs px-2 py-1 rounded whitespace-nowrap z-50">
                        Editing {category} bonus - Drag to move, resize handles to resize
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const positionToSave = tempBonusPositions[category] || bonusContentPositions[category];
                          if (onBonusContentPositionUpdate && positionToSave) {
                            onBonusContentPositionUpdate(category, positionToSave);
                          }
                          setEditingBonusContent(null);
                        }}
                        className="absolute -top-6 right-0 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded z-50 flex items-center gap-1"
                        title="Save position and size"
                      >
                        <Save className="w-3 h-3" />
                        Save
                      </button>
                      {/* Resize handles */}
                      <div 
                        className="resize-handle absolute -top-1 -left-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nwse-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleBonusContentBoxResize(category, e, 'nw');
                        }}
                      />
                      <div 
                        className="resize-handle absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nesw-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleBonusContentBoxResize(category, e, 'ne');
                        }}
                      />
                      <div 
                        className="resize-handle absolute -bottom-1 -left-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nesw-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleBonusContentBoxResize(category, e, 'sw');
                        }}
                      />
                      <div 
                        className="resize-handle absolute -bottom-1 -right-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nwse-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleBonusContentBoxResize(category, e, 'se');
                        }}
                      />
                      <div 
                        className="resize-handle absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-yellow-500 border border-yellow-700 cursor-ns-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleBonusContentBoxResize(category, e, 'n');
                        }}
                      />
                      <div 
                        className="resize-handle absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-yellow-500 border border-yellow-700 cursor-ns-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleBonusContentBoxResize(category, e, 's');
                        }}
                      />
                      <div 
                        className="resize-handle absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-3 bg-yellow-500 border border-yellow-700 cursor-ew-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleBonusContentBoxResize(category, e, 'w');
                        }}
                      />
                      <div 
                        className="resize-handle absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-3 bg-yellow-500 border border-yellow-700 cursor-ew-resize z-50"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleBonusContentBoxResize(category, e, 'e');
                        }}
                      />
                    </>
                  )}
                  {editMode && !isEditing && (
                    <div className="absolute -top-6 left-0 bg-orange-400 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50">
                      {category} bonus - Click to edit
                    </div>
                  )}
                </div>
              );
            })}
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
              <div className="space-y-6">
                {selectedNode.summary && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-gray-800">Details</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedNode.summary}</p>
                  </div>
                )}
                {selectedNode.node_videos && selectedNode.node_videos.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800">Videos</h3>
                    {selectedNode.node_videos.sort((a, b) => a.order_index - b.order_index).map(video => (
                      <div key={video.id}>
                        <h4 className="font-medium mb-2">{video.title}</h4>
                        <div className="aspect-video rounded-lg overflow-hidden">
                          <VimeoPlayer videoUrl={video.video_url} />
                        </div>
                      </div>
                    ))}
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
                    <div><strong>Step:</strong> {showUnlockPrompt.node.title}</div>
                    <div><strong>Required symptoms:</strong> {((edge: AppEdge) => { const s = []; if (edge.unlock_type === 'symptom_match' && edge.unlock_value) { const r = edge.unlock_value as { any?: string[], all?: string[] }; s.push(...(r.any||[]), ...(r.all||[])); } return s.map(k=>symptomsMap.get(k)||k).join(', '); })(showUnlockPrompt.edge)}</div>
                    <div className="text-sm text-gray-600 mt-2">Do you currently have these symptoms?</div>
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

      {/* Category Videos Dialog */}
      <Dialog open={!!selectedCategory} onOpenChange={() => setSelectedCategory(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedCategory && categoryVideos[selectedCategory] && (
            <>
              <DialogHeader className="pr-8">
                <DialogTitle className="text-xl font-semibold">
                  {selectedCategory.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Videos
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {categoryVideos[selectedCategory].sort((a, b) => a.order_index - b.order_index).map(video => (
                  <div key={video.id}>
                    <h4 className="font-medium mb-2">{video.title}</h4>
                    <div className="aspect-video rounded-lg overflow-hidden">
                      <VimeoPlayer videoUrl={video.video_url} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Bonus Content Videos Dialog */}
      <Dialog open={!!selectedBonusContent} onOpenChange={() => setSelectedBonusContent(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedBonusContent && bonusContentVideos[selectedBonusContent] && (
            <>
              <DialogHeader className="pr-8">
                <DialogTitle className="text-xl font-semibold">
                  {selectedBonusContent.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Bonus Content
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {bonusContentVideos[selectedBonusContent].sort((a, b) => a.order_index - b.order_index).map(video => (
                  <div key={video.id}>
                    <h4 className="font-medium mb-2">{video.title}</h4>
                    <div className="aspect-video rounded-lg overflow-hidden">
                      <VimeoPlayer videoUrl={video.video_url} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Introduction Popup with Mini Tree */}
      <Dialog open={showIntroductionPopup} onOpenChange={setShowIntroductionPopup} modal={true}>
        <DialogContent 
          className="max-w-[98vw] w-[98vw] max-h-[98vh] h-[98vh] overflow-hidden p-0" 
          style={{ pointerEvents: 'auto' }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerMove={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
        >
          <DialogHeader className="px-6 pt-6 pb-4" style={{ pointerEvents: 'auto' }}>
            <DialogTitle className="text-xl font-semibold">Introduction Bonus Content</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto" style={{ height: 'calc(98vh - 100px)', pointerEvents: 'auto', width: '100%' }}>
            <IntroductionMiniTree isAdmin={isAdmin} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  return <div className="w-full h-full">{renderActualSVG()}</div>;
}
