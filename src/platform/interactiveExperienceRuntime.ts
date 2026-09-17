export interface CanvasObject {
  id: string;
  type: 'TEXT' | 'SHAPE' | 'PIZZA_SLICE' | 'BUCKET' | 'NUMBER_CARD' | 'DIAGRAM_NODE' | 'CHEMICAL_FORMULA';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  zIndex: number;
  isLocked: boolean;
  visualProperties: {
    color?: string;
    backgroundColor?: string;
    borderColor?: string;
    borderRadius?: string;
    opacity?: number;
    fontSize?: number;
  };
  semanticMeaning: string;
  relationships: string[]; // related object IDs
  behaviour: {
    isDraggable: boolean;
    isResizable: boolean;
    isSortable?: boolean;
    targetBucketId?: string; // for sorting activities
    value?: any; // internal value, e.g. 1/2 or "O2"
  };
  state: Record<string, any>;
}

export class TdbkInteractiveExperienceRuntime {
  private static instance: TdbkInteractiveExperienceRuntime;
  private objects: CanvasObject[] = [];
  private history: CanvasObject[][] = [];

  private constructor() {}

  public static getInstance(): TdbkInteractiveExperienceRuntime {
    if (!TdbkInteractiveExperienceRuntime.instance) {
      TdbkInteractiveExperienceRuntime.instance = new TdbkInteractiveExperienceRuntime();
    }
    return TdbkInteractiveExperienceRuntime.instance;
  }

  public setObjects(objects: CanvasObject[]): void {
    this.saveToHistory();
    this.objects = [...objects];
  }

  public getObjects(): CanvasObject[] {
    return this.objects;
  }

  public addObject(obj: CanvasObject): void {
    this.saveToHistory();
    this.objects.push(obj);
  }

  public updateObject(id: string, updates: Partial<CanvasObject>): void {
    this.saveToHistory();
    this.objects = this.objects.map((obj) => {
      if (obj.id === id) {
        if (obj.isLocked && !updates.isLocked) {
          return obj; // cannot edit locked object unless unlocking
        }
        return { ...obj, ...updates };
      }
      return obj;
    });
  }

  public deleteObject(id: string): void {
    this.saveToHistory();
    this.objects = this.objects.filter((obj) => obj.id !== id || obj.isLocked);
  }

  public duplicateObject(id: string): void {
    const target = this.objects.find((obj) => obj.id === id);
    if (!target) return;
    this.saveToHistory();
    const copy: CanvasObject = {
      ...target,
      id: `copy_${target.id}_${Math.random().toString(36).substr(2, 4)}`,
      x: target.x + 20,
      y: target.y + 20,
      zIndex: this.objects.length + 1,
      isLocked: false,
    };
    this.objects.push(copy);
  }

  private saveToHistory() {
    this.history.push(JSON.parse(JSON.stringify(this.objects)));
    if (this.history.length > 30) {
      this.history.shift();
    }
  }

  public undo(): boolean {
    if (this.history.length === 0) return false;
    const prev = this.history.pop();
    if (prev) {
      this.objects = prev;
      return true;
    }
    return false;
  }
}

export const tdbkInteractiveRuntime = TdbkInteractiveExperienceRuntime.getInstance();
