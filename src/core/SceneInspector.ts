export interface InspectorPropertyField {
  id: string;
  label: string;
  type: 'number' | 'color' | 'slider' | 'text' | 'boolean';
  min?: number;
  max?: number;
  step?: number;
  value: any;
  onChange: (val: any) => void;
}

export interface InspectableEntity {
  id: string;
  name: string;
  category: 'target' | 'obstacle' | 'environment' | 'system';
  colorTag: string; // Hex color tag for visual distinction
  position?: { x: number; y: number };
  properties: InspectorPropertyField[];
}

export interface ModeSceneEntitiesProvider {
  getInspectableEntities: () => InspectableEntity[];
}

