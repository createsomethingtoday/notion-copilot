import { BlockBuilder } from '../content-builder';
import { ParagraphBuilder } from '../block-builders';
import type { NotionBlockContent, NotionRichText, NotionTestBlock } from '../../types/notion-content';

// Create a test builder that extends BlockBuilder
class TestBlockBuilder extends BlockBuilder<NotionTestBlock> {
  constructor() {
    super('test_block');
    this.content = {
      object: 'block',
      type: 'test_block',
      test_block: {
        color: undefined
      },
      has_children: false,
      children: []
    };
  }
}

describe('BlockBuilder', () => {
  describe('type safety', () => {
    it('should initialize with correct type and object', () => {
      const builder = new TestBlockBuilder();
      const content = builder.build();

      expect(content.object).toBe('block');
      expect(content.type).toBe('test_block');
      expect(content.has_children).toBe(false);
      expect(content.children).toEqual([]);
    });

    it('should set color safely', () => {
      const builder = new TestBlockBuilder();
      builder.setColor('blue');
      const content = builder.build();

      expect(content.test_block.color).toBe('blue');
    });
  });

  describe('child blocks', () => {
    it('should add child blocks correctly', () => {
      const builder = new TestBlockBuilder();
      const paragraph = new ParagraphBuilder().setText('Child block');
      
      builder.addChild(paragraph);
      const content = builder.build();

      expect(content.has_children).toBe(true);
      expect(content.children).toBeDefined();
      expect(content.children?.[0].type).toBe('paragraph');
    });

    it('should validate child blocks', () => {
      const builder = new TestBlockBuilder();
      const invalidBuilder = { build: () => ({ invalid: true }) };

      expect(() => {
        // @ts-expect-error Testing runtime validation
        builder.addChild(invalidBuilder);
      }).toThrow();
    });
  });
}); 