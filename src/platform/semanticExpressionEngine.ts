export interface SemanticToken {
  value: string;
  type: 'NUMBER' | 'VARIABLE' | 'OPERATOR' | 'RELATION' | 'ARROW' | 'UNKNOWN';
}

export interface SemanticExpression {
  raw: string;
  tokens: SemanticToken[];
  description: string;
  category: 'MATHEMATICS' | 'CHEMISTRY' | 'FINANCE' | 'COMPARISON' | 'UNKNOWN';
  elements: string[];
}

export class TdbkSemanticExpressionEngine {
  private static instance: TdbkSemanticExpressionEngine;

  private constructor() {}

  public static getInstance(): TdbkSemanticExpressionEngine {
    if (!TdbkSemanticExpressionEngine.instance) {
      TdbkSemanticExpressionEngine.instance = new TdbkSemanticExpressionEngine();
    }
    return TdbkSemanticExpressionEngine.instance;
  }

  public parse(input: string): SemanticExpression {
    const trimmed = input.trim();
    const tokens: SemanticToken[] = this.tokenize(trimmed);
    const category = this.determineCategory(tokens);
    const description = this.generateDescription(tokens, category);
    const elements = tokens.map(t => t.value);

    return {
      raw: trimmed,
      tokens,
      description,
      category,
      elements,
    };
  }

  private tokenize(input: string): SemanticToken[] {
    // Basic tokenizer for math, chemistry arrows, equalities
    // Split keeping symbols like +, -, *, /, =, <, >, ->, H2, O2, Profit, Revenue
    const parts = input.split(/(\s+|\+|−|-|×|\*|÷|\/|=|<|>|→|->)/).filter(p => p && p.trim().length > 0);

    return parts.map((part): SemanticToken => {
      const val = part.trim();
      if (/^\d+(\.\d+)?$/.test(val) || /^\d+\/\d+$/.test(val)) {
        return { value: val, type: 'NUMBER' };
      }
      if (['+', '−', '-', '×', '*', '÷', '/'].includes(val)) {
        return { value: val, type: 'OPERATOR' };
      }
      if (['=', '<', '>'].includes(val)) {
        return { value: val, type: 'RELATION' };
      }
      if (['→', '->'].includes(val)) {
        return { value: val, type: 'ARROW' };
      }
      // Check for formulas or variable words
      if (/^[a-zA-Z\u0020-\u007E_][a-zA-Z0-9_\u2080-\u2089]*$/.test(val)) {
        return { value: val, type: 'VARIABLE' };
      }
      return { value: val, type: 'UNKNOWN' };
    });
  }

  private determineCategory(tokens: SemanticToken[]): 'MATHEMATICS' | 'CHEMISTRY' | 'FINANCE' | 'COMPARISON' | 'UNKNOWN' {
    const values = tokens.map(t => t.value);
    
    if (tokens.some(t => t.type === 'ARROW')) {
      return 'CHEMISTRY';
    }
    if (values.some(v => ['Revenue', 'Cost', 'Profit', 'Margin', 'Expenses', 'Salary'].includes(v))) {
      return 'FINANCE';
    }
    if (tokens.some(t => t.value === '<' || t.value === '>')) {
      return 'COMPARISON';
    }
    if (tokens.some(t => t.type === 'OPERATOR' || t.type === 'NUMBER')) {
      return 'MATHEMATICS';
    }
    return 'UNKNOWN';
  }

  private generateDescription(tokens: SemanticToken[], category: string): string {
    const rawExpression = tokens.map(t => t.value).join(' ');
    switch (category) {
      case 'CHEMISTRY':
        return `Chemical reaction/transformation: ${rawExpression}`;
      case 'FINANCE':
        return `Business / Financial formula balance: ${rawExpression}`;
      case 'COMPARISON':
        return `Comparison relationship inequality check: ${rawExpression}`;
      case 'MATHEMATICS':
        return `Mathematical equation expression: ${rawExpression}`;
      default:
        return `Semantic expression statement: ${rawExpression}`;
    }
  }
}

export const tdbkSemanticExpression = TdbkSemanticExpressionEngine.getInstance();
