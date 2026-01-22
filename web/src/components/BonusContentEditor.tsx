'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { PlusCircle, Trash2, Save, Video } from 'lucide-react';

type BonusContentVideo = {
  id: string;
  video_url: string;
  title: string;
  order_index: number;
};

interface BonusContentEditorProps {
  bonusContentVideos: Record<string, BonusContentVideo[]>;
  onUpdate: () => void;
}

const CATEGORIES = [
  { key: 'skincare', label: 'Skincare' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'oral_care', label: 'Oral Care' },
  { key: 'introduction', label: 'Introduction' },
] as const;

export function BonusContentEditor({ bonusContentVideos, onUpdate }: BonusContentEditorProps) {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryForms, setCategoryForms] = useState<Record<string, BonusContentVideo[]>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const startEditing = (category: string) => {
    setEditingCategory(category);
    setCategoryForms({
      ...categoryForms,
      [category]: bonusContentVideos[category] ? [...bonusContentVideos[category]] : [],
    });
  };

  const cancelEditing = (category: string) => {
    setEditingCategory(null);
    const newForms = { ...categoryForms };
    delete newForms[category];
    setCategoryForms(newForms);
  };

  const addVideo = (category: string) => {
    const videos = categoryForms[category] || [];
    setCategoryForms({
      ...categoryForms,
      [category]: [
        ...videos,
        { id: '', video_url: '', title: '', order_index: videos.length },
      ],
    });
  };

  const removeVideo = (category: string, index: number) => {
    const videos = categoryForms[category] || [];
    const newVideos = videos.filter((_, i) => i !== index).map((v, i) => ({
      ...v,
      order_index: i,
    }));
    setCategoryForms({
      ...categoryForms,
      [category]: newVideos,
    });
  };

  const updateVideo = (category: string, index: number, field: keyof BonusContentVideo, value: string | number) => {
    const videos = categoryForms[category] || [];
    const newVideos = [...videos];
    newVideos[index] = { ...newVideos[index], [field]: value };
    setCategoryForms({
      ...categoryForms,
      [category]: newVideos,
    });
  };

  const saveCategory = async (category: string) => {
    setSaving(category);
    try {
      const videos = categoryForms[category] || [];
      const response = await fetch('/api/admin/bonus-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          videos: videos.filter(v => v.video_url && v.title),
        }),
      });

      if (response.ok) {
        setEditingCategory(null);
        const newForms = { ...categoryForms };
        delete newForms[category];
        setCategoryForms(newForms);
        onUpdate();
      } else {
        alert('Failed to save bonus content videos');
      }
    } catch (error) {
      console.error('Error saving bonus content videos:', error);
      alert('Error saving bonus content videos');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      {CATEGORIES.map(({ key, label }) => {
        const isEditing = editingCategory === key;
        const videos = isEditing ? (categoryForms[key] || []) : (bonusContentVideos[key] || []);
        const isSaving = saving === key;

        return (
          <Card key={key}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{label} Bonus Content</CardTitle>
                  <CardDescription>
                    {key === 'introduction' 
                      ? 'Introduction bonus content (opens popup with mini tree - coming soon)'
                      : `Bonus videos that appear when clicking on the ${label} bonus content box`}
                  </CardDescription>
                </div>
                {!isEditing && (
                  <Button onClick={() => startEditing(key)} variant="outline" size="sm">
                    <Video className="h-4 w-4 mr-2" />
                    Edit Videos
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-4">
                  {key === 'introduction' && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> Introduction bonus content will open a popup with a mini tree. Video editing is disabled for introduction.
                      </p>
                    </div>
                  )}
                  {key !== 'introduction' && videos.length === 0 && (
                    <p className="text-sm text-gray-500">No videos yet. Click "Add Video" to add one.</p>
                  )}
                  {key !== 'introduction' && videos.map((video, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-medium">Video {index + 1}</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeVideo(key, index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div>
                        <Label htmlFor={`${key}-title-${index}`} className="text-xs font-medium text-gray-700">
                          Video Title
                        </Label>
                        <Input
                          id={`${key}-title-${index}`}
                          value={video.title}
                          onChange={(e) => updateVideo(key, index, 'title', e.target.value)}
                          placeholder="e.g., Advanced Skincare Techniques"
                          className="h-10 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`${key}-url-${index}`} className="text-xs font-medium text-gray-700">
                          Video URL (Vimeo)
                        </Label>
                        <Input
                          id={`${key}-url-${index}`}
                          value={video.video_url}
                          onChange={(e) => updateVideo(key, index, 'video_url', e.target.value)}
                          placeholder="https://vimeo.com/..."
                          className="h-10 text-sm"
                        />
                      </div>
                    </div>
                  ))}
                  {key !== 'introduction' && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => addVideo(key)}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <PlusCircle className="h-4 w-4" />
                        Add Video
                      </Button>
                      <Button
                        onClick={() => saveCategory(key)}
                        disabled={isSaving}
                        className="flex items-center gap-2"
                      >
                        <Save className="h-4 w-4" />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </Button>
                      <Button
                        onClick={() => cancelEditing(key)}
                        variant="outline"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                  {key === 'introduction' && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => cancelEditing(key)}
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
                  {key === 'introduction' ? (
                    <p className="text-sm text-gray-500 italic">Introduction bonus content opens a popup (mini tree coming soon).</p>
                  ) : videos.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No bonus videos configured for this category.</p>
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
  );
}
