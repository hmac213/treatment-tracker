"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Edit3, Save, ChevronRight, ChevronDown, Video, FileText, TreePine, Zap, Settings } from 'lucide-react';

type AppNode = { 
  id: string; 
  key: string; 
  title: string; 
  summary?: string | null; 
  video_url?: string | null; 
  is_root: boolean; 
  order_index: number; 
  pos_x?: number | null; 
  pos_y?: number | null; 
  categories?: string[];
};

type AppEdge = { 
  id: string; 
  parent_id: string; 
  child_id: string; 
  unlock_type: 'always' | 'manual' | 'symptom_match'; 
  unlock_value: unknown;
  description?: string | null;
  weight?: number;
};


// Build simple hierarchical tree structure based on edges
function buildTreeStructure(nodes: AppNode[], edges: AppEdge[]) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const childrenMap = new Map<string, { node: AppNode; edge: AppEdge }[]>();
  
  // Build children map with edge information
  edges.forEach(edge => {
    const childNode = nodeMap.get(edge.child_id);
    if (childNode) {
      if (!childrenMap.has(edge.parent_id)) {
        childrenMap.set(edge.parent_id, []);
      }
      childrenMap.get(edge.parent_id)!.push({ node: childNode, edge });
    }
  });
  
  // Find root nodes
  const rootNodes = nodes.filter(n => n.is_root);
  
  // Simple recursive function to build tree
  function buildNode(nodeId: string, depth: number = 0, edgeInfo: AppEdge | null = null): TreeNode {
    const node = nodeMap.get(nodeId)!;
    const nodeChildren = childrenMap.get(nodeId) || [];
    
    // Sort children by edge weight, then by title
    nodeChildren.sort((a, b) => {
      const weightA = a.edge.weight ?? 0;
      const weightB = b.edge.weight ?? 0;
      if (weightA !== weightB) return weightA - weightB;
      return a.node.title.localeCompare(b.node.title);
    });
    
    const childNodes = nodeChildren.map(({ node: childNode, edge }) => 
      buildNode(childNode.id, depth + 1, edge)
    );
    
    return {
      ...node,
      depth,
      children: childNodes,
      hasChildren: childNodes.length > 0,
      isExpanded: true,
      edgeInfo: edgeInfo
    };
  }
  
  // Build tree from root nodes
  return rootNodes.map(root => ({
    type: 'node' as const,
    node: buildNode(root.id, 0, null)
  }));
}

type TreeNode = AppNode & {
  depth: number;
  children: TreeNode[];
  hasChildren: boolean;
  isExpanded: boolean;
  edgeInfo: AppEdge | null; // Edge that leads to this node
};

type CategoryTreeNode = {
  type: 'node';
  node: TreeNode;
};

function getUnlockTypeDisplay(edge: AppEdge | null): { label: string; color: string } {
  if (!edge) return { label: '', color: '' };
  
  switch (edge.unlock_type) {
    case 'always':
      return { label: 'Always available', color: 'text-green-600' };
    case 'manual':
      return { label: 'Manual unlock', color: 'text-blue-600' };
    case 'symptom_match':
      return { label: 'Symptom-based', color: 'text-orange-600' };
    default:
      return { label: edge.unlock_type, color: 'text-gray-600' };
  }
}

function TreeNodeItem({ 
  node, 
  selectedId, 
  onSelect,
  expandedNodes,
  onToggleExpand
}: { 
  node: TreeNode; 
  selectedId: string | null; 
  onSelect: (nodeId: string) => void;
  expandedNodes: Set<string>;
  onToggleExpand: (nodeId: string) => void;
}) {
  const isSelected = selectedId === node.id;
  const isExpanded = expandedNodes?.has(node.id) ?? false;
  const unlockInfo = getUnlockTypeDisplay(node.edgeInfo);
  
  return (
    <>
      <div 
        className={`group relative flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-300 ease-in-out rounded-lg mx-2 mb-1 ${
          isSelected 
            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 shadow-sm' 
            : 'hover:bg-gray-50/80 hover:shadow-sm'
        }`}
        style={{ paddingLeft: `${node.depth * 20 + 16}px` }}
        onClick={() => onSelect(node.id)}
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
        
        {/* Node Icon - only for root */}
        {node.is_root && (
          <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-all duration-200 bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200">
            <TreePine className="h-4 w-4 text-amber-700" />
          </div>
        )}
        
        {/* Node Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium text-sm truncate transition-colors duration-200 ${
              isSelected ? 'text-blue-900' : 'text-gray-900'
            }`}>
              {node.title}
            </span>
            {node.video_url && (
              <div className="flex items-center justify-center w-5 h-5 rounded bg-purple-100 border border-purple-200">
                <Video className="h-3 w-3 text-purple-600" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-gray-500 truncate font-mono bg-gray-100 px-2 py-0.5 rounded">
              {node.key}
            </span>
            {unlockInfo.label && (
              <div className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                unlockInfo.color === 'text-green-600' 
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : unlockInfo.color === 'text-orange-600'
                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                <Zap className="h-3 w-3" />
                {unlockInfo.label}
              </div>
            )}
            {node.categories && node.categories.length > 0 && (
              <div className="flex gap-1">
                {node.categories.map(category => (
                  <Badge key={category} variant="secondary" className="text-xs h-5 px-2 bg-gray-100 text-gray-700 border-0">
                    {category.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Selection Indicator */}
        {isSelected && (
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-100 border border-blue-200">
            <Edit3 className="h-3.5 w-3.5 text-blue-600" />
          </div>
        )}
      </div>
      
      {/* Children with smooth animation */}
      {node.hasChildren && (
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        }`}>
          {node.children.map(child => (
            <TreeNodeItem
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function NodeEditor({ initialNodes, initialEdges }: { initialNodes: AppNode[]; initialEdges: AppEdge[] }) {
  const [nodes, setNodes] = useState<AppNode[]>(initialNodes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  const treeStructure = buildTreeStructure(nodes, initialEdges);
  const selectedNode = selectedId ? nodes.find(n => n.id === selectedId) || null : null;
  
  // Find the tree node with edge info for display
  const findTreeNode = (nodeId: string, treeNodes: CategoryTreeNode[]): TreeNode | null => {
    for (const item of treeNodes) {
      if (item.type === 'node') {
        const found = findInNode(nodeId, item.node);
        if (found) return found;
      }
    }
    return null;
  };
  
  const findInNode = (nodeId: string, node: TreeNode): TreeNode | null => {
    if (node.id === nodeId) return node;
    for (const child of node.children) {
      const found = findInNode(nodeId, child);
      if (found) return found;
    }
    return null;
  };
  
  const selectedTreeNode = selectedId ? findTreeNode(selectedId, treeStructure) : null;
  
  // Initialize expanded state for all nodes with children
  useEffect(() => {
    if (initialNodes.length > 0 && expandedNodes.size === 0) {
      const allNodesWithChildren = new Set<string>();
      function collectExpandedNodes(categoryItems: CategoryTreeNode[]) {
        categoryItems.forEach(item => {
          if (item.type === 'node') {
            collectNodesFromTree([item.node]);
          }
        });
      }
      function collectNodesFromTree(nodeList: TreeNode[]) {
        nodeList.forEach(node => {
          if (node.hasChildren) {
            allNodesWithChildren.add(node.id);
            collectNodesFromTree(node.children);
          }
        });
      }
      collectExpandedNodes(treeStructure);
      setExpandedNodes(allNodesWithChildren);
    }
  }, [initialNodes.length, expandedNodes.size, treeStructure]);
  
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
  
  const [nodeForm, setNodeForm] = useState<{ 
    title: string; 
    video_url: string; 
    summary: string; 
  } | null>(null);
  
  const [edgeForm, setEdgeForm] = useState<{
    description: string;
  } | null>(null);
  
  useEffect(() => {
    if (selectedNode) {
      setNodeForm({ 
        title: selectedNode.title, 
        video_url: selectedNode.video_url ?? '', 
        summary: selectedNode.summary ?? ''
      });
    } else {
      setNodeForm(null);
    }
  }, [selectedNode]);
  
  useEffect(() => {
    if (selectedTreeNode?.edgeInfo) {
      setEdgeForm({
        description: selectedTreeNode.edgeInfo.description ?? ''
      });
    } else {
      setEdgeForm(null);
    }
  }, [selectedTreeNode?.edgeInfo]);
  
  async function saveAll(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedNode || !nodeForm) return;
    
    setSaving(true);
    try {
      // Save node properties first
      const updated: AppNode = { 
        ...selectedNode, 
        title: nodeForm.title, 
        video_url: nodeForm.video_url || null, 
        summary: nodeForm.summary || null
      };
      
      // Update local state
      setNodes(prev => prev.map(n => n.id === selectedNode.id ? updated : n));
      
      // Save node to server
      const nodeRes = await fetch('/api/admin/tree/save', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          nodes: nodes.map(n => n.id === selectedNode.id ? updated : n), 
          edges: initialEdges 
        }) 
      });
      
      // Save edge description if it exists and has changed
      if (selectedTreeNode?.edgeInfo && edgeForm) {
        const edgeRes = await fetch('/api/admin/tree/save-edge', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ 
            edgeId: selectedTreeNode.edgeInfo.id,
            description: edgeForm.description 
          }) 
        });
        
        if (edgeRes.ok) {
          // Update the local edge info to reflect the saved description
          if (selectedTreeNode.edgeInfo) {
            selectedTreeNode.edgeInfo.description = edgeForm.description;
          }
        }
      }
      
      if (nodeRes.ok) {
        alert('Changes saved successfully');
      } else {
        alert('Failed to save node properties');
      }
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  }
  
  
  return (
    <div className="h-full flex bg-gradient-to-br from-gray-50 to-white">
      {/* Tree View */}
      <div className="w-1/2 border-r border-gray-200/60 bg-white/80 backdrop-blur-sm flex flex-col">
        <div className="px-6 py-6 border-b border-gray-200/60 bg-gradient-to-r from-white to-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-green-100 to-emerald-100 border border-green-200">
              <TreePine className="h-4 w-4 text-green-700" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Treatment Tree</h3>
              <p className="text-xs text-gray-600 mt-0.5">Select a node to edit its properties</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {treeStructure.length === 0 ? (
            <div className="p-8 text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-gray-100 border border-gray-200 mx-auto mb-4">
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
              <h4 className="font-medium text-gray-900 mb-2">No nodes found</h4>
              <p className="text-sm text-gray-500">The treatment tree is empty</p>
            </div>
          ) : (
            <div className="py-4">
              {treeStructure.map((item) => (
                <TreeNodeItem
                  key={`node-${item.node.id}`}
                  node={item.node}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  expandedNodes={expandedNodes}
                  onToggleExpand={handleToggleExpand}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Editor Panel */}
      <div className="flex-1 flex flex-col bg-gradient-to-br from-white to-gray-50/30">
        {!selectedNode ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <Card className="max-w-md border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardContent className="text-center p-8">
                <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-50 border border-gray-200 mx-auto mb-6">
                  <Settings className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">No node selected</h3>
                <p className="text-gray-600 leading-relaxed">Select a treatment node from the tree to edit its properties, content, and unlock conditions.</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="px-6 py-6 bg-white/90 backdrop-blur-sm border-b border-gray-200/60">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-200 ${
                  selectedNode.is_root
                    ? 'bg-gradient-to-br from-amber-100 to-orange-100 border-amber-200'
                    : 'bg-gradient-to-br from-blue-100 to-indigo-100 border-blue-200'
                }`}>
                  {selectedNode.is_root ? (
                    <TreePine className="h-6 w-6 text-amber-700" />
                  ) : (
                    <FileText className="h-6 w-6 text-blue-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Edit Treatment Node</h3>
                  <p className="text-sm text-gray-600">Modify properties, content, and unlock conditions</p>
                </div>
              </div>
            </div>
            
            {/* Form */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Combined Form */}
              {nodeForm && (
                <form onSubmit={saveAll} className="space-y-6">
                  {/* Node Properties */}
                  <div className="space-y-6 bg-white p-6 rounded-lg border border-gray-200">
                    <div className="border-b border-gray-200 pb-3">
                      <h3 className="text-lg font-semibold text-gray-900">Node Properties</h3>
                      <p className="text-sm text-gray-600 mt-1">Basic information about this treatment node</p>
                    </div>
                    
                    {/* Title */}
                    <div className="space-y-2">
                      <Label htmlFor="title" className="text-sm font-medium text-gray-900">
                        Title
                      </Label>
                      <Input
                        id="title"
                        value={nodeForm.title}
                        onChange={(e) => setNodeForm({ ...nodeForm, title: e.target.value })}
                        placeholder="Enter treatment title"
                        className="h-11 text-base"
                      />
                    </div>
                    
                    {/* Video URL */}
                    <div className="space-y-2">
                      <Label htmlFor="video_url" className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        <Video className="h-4 w-4 text-purple-500" />
                        Video URL
                      </Label>
                      <Input
                        id="video_url"
                        value={nodeForm.video_url}
                        onChange={(e) => setNodeForm({ ...nodeForm, video_url: e.target.value })}
                        placeholder="https://vimeo.com/..."
                        className="h-11 text-base"
                      />
                    </div>
                    
                    {/* Summary */}
                    <div className="space-y-2">
                      <Label htmlFor="summary" className="text-sm font-medium text-gray-900">
                        Summary
                      </Label>
                      <Textarea
                        id="summary"
                        value={nodeForm.summary}
                        onChange={(e) => setNodeForm({ ...nodeForm, summary: e.target.value })}
                        placeholder="Enter a brief description of this treatment..."
                        rows={4}
                        className="resize-none text-base"
                      />
                    </div>
                    
                    {/* Categories - Read Only */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-gray-900">
                        Categories
                      </Label>
                      <div className="flex gap-2 flex-wrap">
                        {selectedNode.categories && selectedNode.categories.length > 0 ? (
                          selectedNode.categories.map(category => (
                            <Badge key={category} variant="secondary" className="text-sm">
                              {category.replace('_', ' ')}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-gray-500">No categories assigned</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Categories are managed through the database structure and cannot be edited here.
                      </p>
                    </div>
                  </div>
                  
                  {/* Unlock Description (above save button if not root) */}
                  {selectedNode && !selectedNode.is_root && selectedTreeNode?.edgeInfo && edgeForm && (
                    <div className="space-y-6 bg-white p-6 rounded-lg border border-gray-200">
                      <div className="border-b border-gray-200 pb-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Unlock Condition Description
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">Edit the text patients will see explaining when this treatment becomes available</p>
                      </div>
                      
                      <div className="space-y-3">
                        <Label htmlFor="unlock_description" className="text-sm font-medium text-gray-900">
                          Description
                        </Label>
                        <Textarea
                          id="unlock_description"
                          value={edgeForm.description}
                          onChange={(e) => setEdgeForm({ ...edgeForm, description: e.target.value })}
                          placeholder="e.g., 'Available when experiencing skin breakdown or irritation'"
                          rows={3}
                          className="resize-none text-base"
                        />
                        <p className="text-xs text-gray-500">
                          This description explains to patients when this treatment option will become available to them.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Single Save Button */}
                  <div className="pt-4">
                    <Button 
                      type="submit" 
                      className="w-full h-11 text-base bg-blue-600 hover:bg-blue-700" 
                      disabled={saving}
                    >
                      {saving ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Saving...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Save className="h-4 w-4" />
                          Save All Changes
                        </span>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
