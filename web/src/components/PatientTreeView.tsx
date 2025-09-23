"use client";

import { useState } from 'react';
import { ChevronDown, ChevronRight, Lock, TreePine, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { VimeoPlayer } from '@/components/VimeoPlayer';

export type PatientNode = {
  id: string;
  key: string;
  title: string;
  summary: string | null;
  video_url: string | null;
  is_root: boolean;
  node_categories: { category: string }[];
  depth: number;
  children: PatientNode[];
  hasChildren: boolean;
  isUnlocked: boolean;
  isImmediatelyUnlockable: boolean;
  unlockDescription: string | null;
  unlockType: 'always' | 'manual' | 'symptom_match' | null;
  unlockValue: Record<string, unknown> | null;
};

type NodePopupProps = {
  node: PatientNode | null;
  isOpen: boolean;
  onClose: () => void;
};

function NodePopup({ node, isOpen, onClose }: NodePopupProps) {
  if (!node) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold pr-8">{node.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {node.video_url && (
            <div className="w-full">
              <VimeoPlayer videoUrl={node.video_url} />
            </div>
          )}
          {node.summary && (
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 leading-relaxed">{node.summary}</p>
            </div>
          )}
          {!node.summary && !node.video_url && (
            <p className="text-gray-500 italic">No additional content available for this step.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type UnlockPromptProps = {
  node: PatientNode | null;
  isOpen: boolean;
  onClose: () => void;
  onUnlock: (nodeId: string) => Promise<void>;
};

function UnlockPrompt({ node, isOpen, onClose, onUnlock }: UnlockPromptProps) {
  if (!node) return null;

  const handleYes = async () => {
    await onUnlock(node.id);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-lg text-center">Unlock Treatment Step</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-2">
          <div className="text-center space-y-3">
            <h3 className="font-medium text-gray-900 text-base">{node.title}</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 leading-relaxed">
                <span className="font-medium text-blue-800">This step can be unlocked when:</span>
                <br />
                <span className="mt-1 block">{node.unlockDescription || 'You meet the required conditions'}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 pt-2">
            <Button onClick={handleYes} className="bg-green-600 hover:bg-green-700 w-full">
              Yes, I have these symptoms
            </Button>
            <Button variant="outline" onClick={onClose} className="w-full">
              No, I don&apos;t have these symptoms
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type PatientTreeNodeProps = {
  node: PatientNode;
  expandedNodes: Set<string>;
  onToggleExpand: (nodeId: string) => void;
  onNodeClick: (node: PatientNode) => void;
};

function PatientTreeNode({ node, expandedNodes, onToggleExpand, onNodeClick }: PatientTreeNodeProps) {
  const isExpanded = expandedNodes.has(node.id);
  
  const handleClick = () => {
    onNodeClick(node);
  };

  return (
    <>
      <div 
        className={`group relative flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-300 ease-in-out rounded-lg mx-2 mb-1 ${
          node.isUnlocked
            ? 'hover:bg-green-50/80 hover:shadow-sm border border-green-100'
            : node.isImmediatelyUnlockable
            ? 'hover:bg-yellow-50/80 hover:shadow-sm border border-yellow-100'
            : 'bg-gray-50/50 border border-gray-100 cursor-not-allowed opacity-60'
        }`}
        style={{ paddingLeft: `${node.depth * 20 + 16}px` }}
        onClick={handleClick}
      >
        {/* Expand/Collapse Toggle */}
        {node.hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-white/80 transition-all duration-200 z-10 border border-transparent hover:border-gray-200"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-gray-600 transition-transform duration-200" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-gray-600 transition-transform duration-200" />
            )}
          </button>
        )}
        {!node.hasChildren && <div className="w-6" />}
        
        {/* Node Icon */}
        {node.is_root ? (
          <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-all duration-200 bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200">
            <TreePine className="h-4 w-4 text-amber-700" />
          </div>
        ) : (
          <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-all duration-200 ${
            node.isUnlocked
              ? 'bg-gradient-to-br from-green-100 to-emerald-100 border border-green-200'
              : 'bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-300'
          }`}>
            {node.isUnlocked ? (
              <CheckCircle2 className="h-4 w-4 text-green-700" />
            ) : (
              <Lock className="h-4 w-4 text-gray-600" />
            )}
          </div>
        )}
        
        {/* Node Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className={`font-medium truncate ${
              node.isUnlocked ? 'text-gray-900' : 'text-gray-600'
            }`}>
              {node.title}
            </div>
            {node.node_categories.length > 0 && (
              <div className="flex gap-1 shrink-0">
                {node.node_categories.slice(0, 2).map(({ category }) => (
                  <span 
                    key={category}
                    className={`px-2 py-0.5 text-xs rounded-full border ${
                      node.isUnlocked 
                        ? 'bg-blue-50 text-blue-700 border-blue-200' 
                        : 'bg-gray-100 text-gray-500 border-gray-200'
                    }`}
                  >
                    {category}
                  </span>
                ))}
                {node.node_categories.length > 2 && (
                  <span className="text-xs text-gray-400">+{node.node_categories.length - 2}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status Indicator */}
        <div className="shrink-0">
          {node.isUnlocked ? (
            <span className="text-xs text-green-600 font-medium">Available</span>
          ) : node.isImmediatelyUnlockable ? (
            <span className="text-xs text-yellow-600 font-medium">Can Unlock</span>
          ) : (
            <span className="text-xs text-gray-400">Locked</span>
          )}
        </div>
      </div>

      {/* Children */}
      {node.hasChildren && isExpanded && (
        <div className={`transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        }`}>
          {node.children.map(child => (
            <PatientTreeNode
              key={child.id}
              node={child}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      )}
    </>
  );
}

type PatientTreeViewProps = {
  treeStructure: PatientNode[];
};

export function PatientTreeView({ treeStructure }: PatientTreeViewProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set(treeStructure.map(node => node.id)) // Start with root expanded
  );
  const [selectedNode, setSelectedNode] = useState<PatientNode | null>(null);
  const [showNodePopup, setShowNodePopup] = useState(false);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);

  const handleToggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const handleNodeClick = (node: PatientNode) => {
    setSelectedNode(node);
    
    if (node.isUnlocked) {
      // Show node details popup
      setShowNodePopup(true);
    } else if (node.isImmediatelyUnlockable) {
      // Show unlock prompt
      setShowUnlockPrompt(true);
    }
    // If locked and not immediately unlockable, do nothing
  };

  const handleUnlock = async (nodeId: string) => {
    try {
      // Call the unlock API
      const response = await fetch('/api/unlock-node', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          nodeId: nodeId
        }),
      });

      if (response.ok) {
        // Refresh the page to show updated state
        window.location.reload();
      } else {
        const errorData = await response.json();
        console.error('Failed to unlock node:', errorData.error);
        alert(`Failed to unlock: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error unlocking node:', error);
      alert('An error occurred while unlocking the node');
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-50 to-white min-h-screen">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Treatment Path</h1>
          <p className="text-gray-600">
            Navigate through your personalized treatment journey. Click on available steps to view details, 
            or unlock new steps when you meet the conditions.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4">
            {treeStructure.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <TreePine className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No treatment steps available yet.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {treeStructure.map(node => (
                  <PatientTreeNode
                    key={node.id}
                    node={node}
                    expandedNodes={expandedNodes}
                    onToggleExpand={handleToggleExpand}
                    onNodeClick={handleNodeClick}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Popups */}
      <NodePopup 
        node={selectedNode}
        isOpen={showNodePopup}
        onClose={() => setShowNodePopup(false)}
      />
      <UnlockPrompt
        node={selectedNode}
        isOpen={showUnlockPrompt}
        onClose={() => setShowUnlockPrompt(false)}
        onUnlock={handleUnlock}
      />
    </div>
  );
}
