import type {
  NotionRichText,
  NotionBlockContent,
  NotionPageContent,
  NotionProperties
} from '../types/notion-content';
import { ContentValidator } from '../services/content-validator';

type BlockContentWithColor = {
  color?: string;
  [key: string]: unknown;
};

type BlockContentMap = {
  [key: string]: BlockContentWithColor;
};

/**
 * Base builder for all content types
 */
export abstract class ContentBuilder<T> {
  protected validator: ContentValidator;
  
  constructor() {
    this.validator = new ContentValidator();
  }

  /**
   * Creates rich text content
   */
  protected createRichText(text: string, options: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
    link?: string;
  } = {}): NotionRichText[] {
    return [{
      type: 'text',
      text: {
        content: text,
        link: options.link ? { url: options.link } : undefined
      },
      annotations: {
        bold: options.bold,
        italic: options.italic,
        strikethrough: options.strikethrough,
        underline: options.underline,
        code: options.code,
        color: options.color
      }
    }];
  }

  /**
   * Validates the built content
   */
  protected abstract validate(content: unknown): void;

  /**
   * Builds the final content
   */
  abstract build(): T;
}

/**
 * Base builder for block content
 */
export abstract class BlockBuilder<T extends NotionBlockContent & { object: 'block'; type: string }> extends ContentBuilder<T> {
  protected content: Omit<Partial<T>, 'type'> & { type: T['type']; object: 'block' };
  protected childBuilders: BlockBuilder<NotionBlockContent & { object: 'block'; type: string }>[];

  constructor(type: T['type']) {
    super();
    // Initialize with minimal required properties
    this.content = {
      object: 'block',
      type
    } as Omit<Partial<T>, 'type'> & { type: T['type']; object: 'block' };
    this.childBuilders = [];
  }

  /**
   * Adds a child block
   */
  addChild(builder: BlockBuilder<NotionBlockContent & { object: 'block'; type: string }>): this {
    this.childBuilders.push(builder);
    return this;
  }

  /**
   * Sets the color of the block (if supported)
   */
  setColor(color: string): this {
    const content = this.content as unknown as BlockContentMap;
    const blockContent = content[this.content.type] || {};
    blockContent.color = color;
    content[this.content.type] = blockContent;
    return this;
  }

  protected validate(content: unknown): void {
    this.validator.validateBlockContent(content);
  }

  build(): T {
    // Build children if any
    if (this.childBuilders.length > 0) {
      const builtContent = this.content as T & { children?: NotionBlockContent[] };
      builtContent.children = this.childBuilders.map(builder => builder.build());
    }

    // Validate and return
    const content = this.content as T;
    this.validate(content);
    return content;
  }
}

/**
 * Base builder for page content
 */
export abstract class PageBuilder extends ContentBuilder<NotionPageContent> {
  protected content: Partial<NotionPageContent>;
  protected childBuilders: BlockBuilder<NotionBlockContent & { object: 'block'; type: string }>[];

  constructor() {
    super();
    this.content = {
      properties: {}
    };
    this.childBuilders = [];
  }

  /**
   * Sets the parent (database or page)
   */
  setParent(type: 'database_id' | 'page_id', id: string): this {
    this.content.parent = {
      type,
      [type]: id
    };
    return this;
  }

  /**
   * Adds a property
   */
  addProperty(key: string, value: NotionProperties[string]): this {
    if (!this.content.properties) {
      this.content.properties = {};
    }
    this.content.properties[key] = value;
    return this;
  }

  /**
   * Adds a child block
   */
  addChild(builder: BlockBuilder<NotionBlockContent & { object: 'block'; type: string }>): this {
    this.childBuilders.push(builder);
    return this;
  }

  /**
   * Sets the icon (emoji or external URL)
   */
  setIcon(icon: string | { url: string }): this {
    this.content.icon = typeof icon === 'string' 
      ? { type: 'emoji', emoji: icon }
      : { type: 'external', external: icon };
    return this;
  }

  /**
   * Sets the cover image
   */
  setCover(url: string): this {
    this.content.cover = {
      type: 'external',
      external: { url }
    };
    return this;
  }

  protected validate(content: unknown): void {
    this.validator.validatePageContent(content);
  }

  build(): NotionPageContent {
    // Build children if any
    if (this.childBuilders.length > 0) {
      this.content.children = this.childBuilders.map(builder => builder.build());
    }

    // Validate and return
    const content = this.content as NotionPageContent;
    this.validate(content);
    return content;
  }
} 