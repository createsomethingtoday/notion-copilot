import type { NotionBlockContent } from '../types/notion-content';
import { ContentValidator } from './content-validator';

export abstract class ContentBuilder<T> {
  protected content: Partial<T>;
  protected validator: ContentValidator;

  constructor() {
    this.content = {};
    this.validator = new ContentValidator();
  }

  public abstract build(): T;
}

type BlockContent = NotionBlockContent & { object: 'block'; type: string; has_children?: boolean; children?: NotionBlockContent[] };

export abstract class BlockBuilder<T extends BlockContent> extends ContentBuilder<T> {
  protected childBuilders: BlockBuilder<BlockContent>[] = [];

  constructor(type: T['type']) {
    super();
    this.content = {
      object: 'block',
      type,
    } as Partial<T>;
  }

  public setColor(color: string): this {
    const blockContent = this.content as { [key: string]: { color?: string } };
    if (blockContent[this.content.type as string]) {
      blockContent[this.content.type as string].color = color;
    }
    return this;
  }

  public addChild(builder: BlockBuilder<BlockContent>): this {
    this.childBuilders.push(builder);
    return this;
  }

  public build(): T {
    if (this.childBuilders.length > 0) {
      (this.content as BlockContent).has_children = true;
      (this.content as BlockContent).children = this.childBuilders.map(builder => builder.build());
    }
    return this.content as T;
  }
} 