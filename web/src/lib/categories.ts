export type CategoryKey = 'start' | 'skincare' | 'nutrition' | 'oral_care' | 'pain';

export const categoryInfo: Record<CategoryKey, { label: string; color: string }> = {
  start: { label: 'Start', color: '#d9ead3' },
  skincare: { label: 'Skincare', color: '#e6e6fa' },
  nutrition: { label: 'Nutrition', color: '#d9f0ff' },
  oral_care: { label: 'Oral Care', color: '#eaf7ea' },
  pain: { label: 'Pain', color: '#ffe5e5' },
};

export function getCategoryForNodeKey(key: string): CategoryKey {
  if (key === 'root') return 'start';
  if (key.startsWith('skin') || key === 'calendula' || key === 'silvadene' || key === 'mepliex') return 'skincare';
  if (key.startsWith('eat') || key.includes('diet') || key.includes('tube')) return 'nutrition';
  if (key.includes('mugard') || key === 'oral_care' || key === 'supportive' || key === 'apply_mugard_spot') return 'oral_care';
  return 'pain';
} 