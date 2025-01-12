import type { NotionBlockContent, NotionRichText } from '../types/notion-content';
import { BlockBuilder } from './content-builder';

/**
 * Builder for paragraph blocks
 */
export class ParagraphBuilder extends BlockBuilder<NotionBlockContent & { type: 'paragraph' }> {
  constructor() {
    super('paragraph');
    this.content.paragraph = { rich_text: [] };
  }

  setText(text: string, options?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
    link?: string;
  }): this {
    if (this.content.paragraph) {
      this.content.paragraph.rich_text = this.createRichText(text, options);
    }
    return this;
  }
}

/**
 * Builder for heading blocks
 */
export class HeadingBuilder extends BlockBuilder<NotionBlockContent & { type: 'heading_1' | 'heading_2' | 'heading_3' }> {
  constructor(level: 1 | 2 | 3) {
    super(`heading_${level}`);
    const type = `heading_${level}` as const;
    this.content[type] = { rich_text: [] };
  }

  setText(text: string, options?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
    link?: string;
  }): this {
    const type = this.content.type;
    if (this.content[type]) {
      this.content[type].rich_text = this.createRichText(text, options);
    }
    return this;
  }
}

/**
 * Builder for bulleted list item blocks
 */
export class BulletedListBuilder extends BlockBuilder<NotionBlockContent & { type: 'bulleted_list_item' }> {
  constructor() {
    super('bulleted_list_item');
    this.content.bulleted_list_item = { rich_text: [] };
  }

  setText(text: string, options?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
    link?: string;
  }): this {
    if (this.content.bulleted_list_item) {
      this.content.bulleted_list_item.rich_text = this.createRichText(text, options);
    }
    return this;
  }
}

/**
 * Builder for numbered list item blocks
 */
export class NumberedListBuilder extends BlockBuilder<NotionBlockContent & { type: 'numbered_list_item' }> {
  constructor() {
    super('numbered_list_item');
    this.content.numbered_list_item = { rich_text: [] };
  }

  setText(text: string, options?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
    link?: string;
  }): this {
    if (this.content.numbered_list_item) {
      this.content.numbered_list_item.rich_text = this.createRichText(text, options);
    }
    return this;
  }
}

/**
 * Builder for to-do blocks
 */
export class ToDoBuilder extends BlockBuilder<NotionBlockContent & { type: 'to_do' }> {
  constructor() {
    super('to_do');
    this.content.to_do = { rich_text: [], checked: false };
  }

  setText(text: string, options?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
    link?: string;
  }): this {
    if (this.content.to_do) {
      this.content.to_do.rich_text = this.createRichText(text, options);
    }
    return this;
  }

  setChecked(checked: boolean): this {
    if (this.content.to_do) {
      this.content.to_do.checked = checked;
    }
    return this;
  }
}

/**
 * Builder for toggle blocks
 */
export class ToggleBuilder extends BlockBuilder<NotionBlockContent & { type: 'toggle' }> {
  constructor() {
    super('toggle');
    this.content.toggle = { rich_text: [] };
  }

  setText(text: string, options?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
    link?: string;
  }): this {
    if (this.content.toggle) {
      this.content.toggle.rich_text = this.createRichText(text, options);
    }
    return this;
  }
}

/**
 * Builder for code blocks
 */
export class CodeBuilder extends BlockBuilder<NotionBlockContent & { type: 'code' }> {
  constructor() {
    super('code');
    this.content.code = { rich_text: [], language: 'plain text' };
  }

  setText(text: string, options?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
    link?: string;
  }): this {
    if (this.content.code) {
      this.content.code.rich_text = this.createRichText(text, options);
    }
    return this;
  }

  setLanguage(language: string): this {
    if (this.content.code) {
      this.content.code.language = language;
    }
    return this;
  }

  setCaption(caption: string): this {
    if (this.content.code) {
      this.content.code.caption = this.createRichText(caption);
    }
    return this;
  }
}

/**
 * Builder for quote blocks
 */
export class QuoteBuilder extends BlockBuilder<NotionBlockContent & { type: 'quote' }> {
  constructor() {
    super('quote');
    this.content.quote = { rich_text: [] };
  }

  setText(text: string, options?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
    link?: string;
  }): this {
    if (this.content.quote) {
      this.content.quote.rich_text = this.createRichText(text, options);
    }
    return this;
  }
}

/**
 * Builder for divider blocks
 */
export class DividerBuilder extends BlockBuilder<NotionBlockContent & { type: 'divider' }> {
  constructor() {
    super('divider');
    this.content.divider = {};
  }
}

/**
 * Builder for callout blocks
 */
export class CalloutBuilder extends BlockBuilder<NotionBlockContent & { type: 'callout' }> {
  constructor() {
    super('callout');
    this.content.callout = { rich_text: [] };
  }

  setText(text: string, options?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
    link?: string;
  }): this {
    if (this.content.callout) {
      this.content.callout.rich_text = this.createRichText(text, options);
    }
    return this;
  }

  setIcon(icon: string | { url: string }): this {
    if (this.content.callout) {
      this.content.callout.icon = typeof icon === 'string'
        ? { type: 'emoji', emoji: icon }
        : { type: 'external', external: icon };
    }
    return this;
  }
}

/**
 * Builder for table blocks
 */
export class TableBuilder extends BlockBuilder<NotionBlockContent & { type: 'table' }> {
  constructor(columnCount: number) {
    super('table');
    this.content.table = {
      table_width: columnCount,
      has_column_header: false,
      has_row_header: false,
      children: []
    };
  }

  setHasColumnHeader(hasHeader: boolean): this {
    if (this.content.table) {
      this.content.table.has_column_header = hasHeader;
    }
    return this;
  }

  setHasRowHeader(hasHeader: boolean): this {
    if (this.content.table) {
      this.content.table.has_row_header = hasHeader;
    }
    return this;
  }

  addRow(cells: string[]): this {
    if (this.content.table) {
      if (cells.length !== this.content.table.table_width) {
        throw new Error(`Invalid number of cells: expected ${this.content.table.table_width}, got ${cells.length}`);
      }

      const row = {
        type: 'table_row' as const,
        table_row: {
          cells: cells.map(cell => this.createRichText(cell))
        }
      };
      
      if (!this.content.table.children) {
        this.content.table.children = [];
      }
      
      this.content.table.children.push(row);
    }
    return this;
  }
} 