import { BlockBuilder } from '../content-builder';
import type { NotionTestBlock } from '../../types/notion-content';

class TestBlockBuilder extends BlockBuilder<NotionTestBlock> {
  constructor() {
    super('test_block');
  }
}

describe('BlockBuilder', () => {
  it('should initialize with correct type', () => {
    const builder = new TestBlockBuilder();
    const content = builder.build();
    expect(content.object).toBe('block');
    expect(content.type).toBe('test_block');
  });

  it('should set color correctly', () => {
    const builder = new TestBlockBuilder();
    builder.setColor('blue');
    const content = builder.build();
    expect(content.test_block?.color).toBe('blue');
  });

  it('should add child blocks correctly', () => {
    const parent = new TestBlockBuilder();
    const child = new TestBlockBuilder();
    parent.addChild(child);
    const content = parent.build();
    expect(content.has_children).toBe(true);
    expect(content.children?.length).toBe(1);
    expect(content.children?.[0].type).toBe('test_block');
  });

  it('should support method chaining', () => {
    const builder = new TestBlockBuilder();
    const content = builder
      .setColor('red')
      .addChild(new TestBlockBuilder())
      .build();
    expect(content.test_block?.color).toBe('red');
    expect(content.has_children).toBe(true);
  });
}); 