'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { VimeoPlayer } from './VimeoPlayer';
import { Save, ZoomIn, ZoomOut, RotateCcw, Edit2 } from 'lucide-react';

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

interface IntroductionMiniTreeProps {
  isAdmin?: boolean;
  onUpdate?: () => void;
}

export function IntroductionMiniTree({ isAdmin = false, onUpdate }: IntroductionMiniTreeProps) {
  const [nodes, setNodes] = useState<MiniTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<MiniTreeNode | null>(null);
  const [tempPositions, setTempPositions] = useState<Record<string, { x: number; y: number; width: number; height: number }>>({});
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const wasDragged = useRef(false);
  const panContainerRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const svgImageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    fetchNodes();
  }, []);


  const fetchNodes = async () => {
    try {
      const response = await fetch('/api/admin/introduction-tree');
      if (response.ok) {
        const data = await response.json();
        setNodes(data.nodes || []);
        
        // Initialize temp positions
        const positions: Record<string, { x: number; y: number; width: number; height: number }> = {};
        (data.nodes || []).forEach((node: MiniTreeNode) => {
          positions[node.id] = {
            x: node.pos_x,
            y: node.pos_y,
            width: node.width,
            height: node.height,
          };
        });
        setTempPositions(positions);
      }
    } catch (error) {
      console.error('Failed to fetch nodes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNodeDrag = (nodeId: string, e: React.MouseEvent) => {
    if (!editMode || editingNode !== nodeId) return;
    e.preventDefault();
    e.stopPropagation();
    wasDragged.current = false;

    // Use the image container's dimensions
    const container = imageContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    const startX = e.clientX;
    const startY = e.clientY;
    const currentPos = tempPositions[nodeId] || { x: 0, y: 0, width: 10, height: 5 };
    const startPosX = currentPos.x;
    const startPosY = currentPos.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      wasDragged.current = true;
      const deltaX = ((moveEvent.clientX - startX) / containerWidth) * 100;
      const deltaY = ((moveEvent.clientY - startY) / containerHeight) * 100;

      const newX = Math.max(0, Math.min(100 - currentPos.width, startPosX + deltaX));
      const newY = Math.max(0, Math.min(100 - currentPos.height, startPosY + deltaY));

      setTempPositions(prev => ({
        ...prev,
        [nodeId]: { ...currentPos, x: newX, y: newY }
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

  const handleNodeResize = (
    nodeId: string,
    e: React.MouseEvent,
    handle: 'se' | 'sw' | 'ne' | 'nw' | 'e' | 'w' | 'n' | 's'
  ) => {
    if (!editMode || editingNode !== nodeId) return;
    e.preventDefault();
    e.stopPropagation();
    wasDragged.current = false;

    // Use the image container's dimensions
    const container = imageContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    const startX = e.clientX;
    const startY = e.clientY;
    const currentPos = tempPositions[nodeId] || { x: 0, y: 0, width: 10, height: 5 };
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

      setTempPositions(prev => ({
        ...prev,
        [nodeId]: { x: newX, y: newY, width: newWidth, height: newHeight }
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

  const saveNodePosition = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const position = tempPositions[nodeId];
    if (!position) return;

    try {
      const response = await fetch('/api/admin/introduction-tree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert_node',
          node: {
            id: node.id,
            node_key: node.node_key,
            title: node.title,
            pos_x: position.x,
            pos_y: position.y,
            width: position.width,
            height: position.height,
            videos: node.videos,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...data.node, pos_x: position.x, pos_y: position.y, width: position.width, height: position.height } : n));
        setEditingNode(null);
        if (onUpdate) onUpdate();
      } else {
        alert('Failed to save position');
      }
    } catch (error) {
      console.error('Error saving position:', error);
      alert('Error saving position');
    }
  };

  const handleNodeClick = (node: MiniTreeNode) => {
    if (editMode && editingNode === node.id) {
      saveNodePosition(node.id);
    } else if (editMode) {
      setEditingNode(node.id);
      if (!tempPositions[node.id]) {
        setTempPositions(prev => ({
          ...prev,
          [node.id]: { x: node.pos_x, y: node.pos_y, width: node.width, height: node.height }
        }));
      }
    } else {
      // Show node videos (if not "Logistics of treatment")
      if (node.node_key !== 'logistics' && node.videos.length > 0) {
        setSelectedNode(node);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractiveElement = target.closest('[data-mini-node], .resize-handle');

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

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.5), 3));
  };

  if (loading) {
    return <div className="p-8 text-center">Loading mini tree...</div>;
  }

  return (
    <div className="w-full h-full flex flex-col relative" style={{ width: '100%', minWidth: '100%' }}>
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 zoom-controls" style={{ pointerEvents: 'auto' }}>
        {isAdmin && (
          <Button
            size="icon"
            variant={editMode ? 'default' : 'outline'}
            onClick={() => {
              if (editMode) {
                setEditMode(false);
                setEditingNode(null);
                // Reset temp positions to saved positions
                const positions: Record<string, { x: number; y: number; width: number; height: number }> = {};
                nodes.forEach(node => {
                  positions[node.id] = {
                    x: node.pos_x,
                    y: node.pos_y,
                    width: node.width,
                    height: node.height,
                  };
                });
                setTempPositions(positions);
              } else {
                setEditMode(true);
              }
            }}
            title={editMode ? 'Exit Edit Mode' : 'Edit Positions'}
            className="bg-white/90 hover:bg-white"
          >
            {editMode ? <Save className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
          </Button>
        )}
        <Button
          size="icon"
          variant="outline"
          onClick={() => setZoom(prev => Math.min(prev * 1.2, 3))}
          title="Zoom In"
          className="bg-white/90 hover:bg-white"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => setZoom(prev => Math.max(prev / 1.2, 0.5))}
          title="Zoom Out"
          className="bg-white/90 hover:bg-white"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => {
            setZoom(1);
            setPanX(0);
            setPanY(0);
          }}
          title="Reset View"
          className="bg-white/90 hover:bg-white"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
      <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded text-sm z-50" style={{ pointerEvents: 'auto' }}>
        {Math.round(zoom * 100)}%
        {editMode && <span className="ml-2 text-yellow-400">EDIT MODE</span>}
      </div>

      <div
        ref={panContainerRef}
        className="relative w-full flex-1 overflow-hidden bg-gray-100"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
        onWheelCapture={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {/* SVG Background and Node Overlays Container */}
        <div 
          className="absolute inset-0 flex items-center justify-center" 
          style={{ 
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, 
            transformOrigin: 'center center', 
            transition: isPanning ? 'none' : 'transform 0.2s ease-out'
          }}
        >
          <div ref={imageContainerRef} className="relative w-full max-w-6xl" style={{ aspectRatio: '2059.54 / 2191.19' }}>
            <img
              ref={svgImageRef}
              src="/APERTURE decision tree real - Frame 2.svg"
              alt="Introduction Mini Tree"
              className="w-full h-full"
              draggable={false}
              style={{ pointerEvents: 'auto' }}
            />
            
            <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
                {nodes.map(node => {
                  const position = editMode && editingNode === node.id
                    ? (tempPositions[node.id] || { x: node.pos_x, y: node.pos_y, width: node.width, height: node.height })
                    : { x: node.pos_x, y: node.pos_y, width: node.width, height: node.height };
                  
                  const isEditing = editMode && editingNode === node.id;
                  const hasVideos = node.node_key !== 'logistics' && node.videos.length > 0;

                  return (
                    <div
                      key={node.id}
                      data-mini-node={node.id}
                      className={`absolute transition-all duration-200 rounded select-none ${
                        isEditing
                          ? 'border-2 border-yellow-500 bg-yellow-500/30 cursor-move shadow-lg'
                          : editMode
                            ? 'border-2 border-blue-500 bg-blue-500/30 cursor-pointer hover:bg-blue-500/40 shadow-md'
                            : hasVideos
                              ? 'border-2 border-green-500 bg-transparent cursor-pointer hover:bg-green-500/10'
                              : 'border-2 border-gray-400 bg-transparent'
                      }`}
                      style={{
                        left: `${position.x}%`,
                        top: `${position.y}%`,
                        width: `${position.width}%`,
                        height: `${position.height}%`,
                        pointerEvents: 'auto',
                        zIndex: isEditing ? 100 : (editMode ? 50 : 5),
                        position: 'absolute',
                      }}
                      onMouseDown={(e) => {
                        if (isEditing && e.button === 0 && !(e.target as HTMLElement).classList.contains('resize-handle')) {
                          e.stopPropagation();
                          handleNodeDrag(node.id, e);
                        }
                      }}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
                        e.stopPropagation();
                        if (!wasDragged.current) {
                          handleNodeClick(node);
                        }
                      }}
                      title={editMode ? (isEditing ? `Editing ${node.title}. Drag to move, resize handles to resize, click to save.` : `Click to edit ${node.title} position`) : node.title}
                    >
                      {isEditing && (
                        <>
                          <div className="absolute -top-4 left-0 bg-yellow-500 text-black text-[9px] px-1 py-0.5 rounded whitespace-nowrap z-50 leading-tight">
                            Editing {node.title}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              saveNodePosition(node.id);
                            }}
                            className="absolute -top-4 right-0 bg-green-600 hover:bg-green-700 text-white text-[9px] px-1.5 py-0.5 rounded z-50 flex items-center gap-1 leading-tight"
                          >
                            <Save className="w-2 h-2" />
                            Save
                          </button>
                          {/* Resize handles */}
                          <div className="resize-handle absolute -top-1 -left-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nwse-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleNodeResize(node.id, e, 'nw'); }} />
                          <div className="resize-handle absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nesw-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleNodeResize(node.id, e, 'ne'); }} />
                          <div className="resize-handle absolute -bottom-1 -left-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nesw-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleNodeResize(node.id, e, 'sw'); }} />
                          <div className="resize-handle absolute -bottom-1 -right-1 w-3 h-3 bg-yellow-500 border border-yellow-700 cursor-nwse-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleNodeResize(node.id, e, 'se'); }} />
                          <div className="resize-handle absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-yellow-500 border border-yellow-700 cursor-ns-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleNodeResize(node.id, e, 'n'); }} />
                          <div className="resize-handle absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-yellow-500 border border-yellow-700 cursor-ns-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleNodeResize(node.id, e, 's'); }} />
                          <div className="resize-handle absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-3 bg-yellow-500 border border-yellow-700 cursor-ew-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleNodeResize(node.id, e, 'w'); }} />
                          <div className="resize-handle absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-3 bg-yellow-500 border border-yellow-700 cursor-ew-resize z-50" onMouseDown={(e) => { e.stopPropagation(); handleNodeResize(node.id, e, 'e'); }} />
                        </>
                      )}
                      {editMode && !isEditing && (
                        <div className="absolute -top-4 left-0 bg-blue-500 text-white text-[9px] px-1 py-0.5 rounded whitespace-nowrap z-50 shadow-md leading-tight">
                          {node.title} - Click to edit
                        </div>
                      )}
                      {/* No title text in patient view - only show in admin edit mode */}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* Node Videos Dialog */}
      <Dialog open={!!selectedNode} onOpenChange={() => setSelectedNode(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedNode && (
            <>
              <DialogHeader className="pr-8">
                <DialogTitle className="text-xl font-semibold">{selectedNode.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {selectedNode.videos.sort((a, b) => a.order_index - b.order_index).map(video => (
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
    </div>
  );
}
