import { BlockBuilder } from '../content-builder';
import { ParagraphBuilder } from '../block-builders';
import type { NotionBlockContent } from '../../types/notion-content';

// Define the test block content structure
type TestBlockContent = {
  object: 'block';
  type: 'test_block';
  test_block: {
    color?: string;
  };
  has_children?: boolean;
  children?: NotionBlockContent[];
  // Add required properties from NotionBlockContent with null
  paragraph: null;
  heading_1: null;
  heading_2: null;
  heading_3: null;
  bulleted_list_item: null;
  numbered_list_item: null;
  to_do: null;
  toggle: null;
  code: null;
  quote: null;
  callout: null;
  divider: null;
  table: null;
  table_of_contents: null;
};

// Create a test builder that extends BlockBuilder
class TestBlockBuilder extends BlockBuilder<TestBlockContent> {
  constructor() {
    super('test_block');
    this.content = {
      object: 'block',
      type: 'test_block',
      test_block: {},
      paragraph: null,
      heading_1: null,
      heading_2: null,
      heading_3: null,
      bulleted_list_item: null,
      numbered_list_item: null,
      to_do: null,
      toggle: null,
      code: null,
      quote: null,
      callout: null,
      divider: null,
      table: null,
      table_of_contents: null
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
    });

    it('should set color safely', () => {
      const builder = new TestBlockBuilder();
      builder.setColor('red');
      const content = builder.build();

      expect(content.test_block).toBeDefined();
      expect(content.test_block.color).toBe('red');
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

  describe('content validation', () => {
    it('should validate required properties', () => {
      const builder = new TestBlockBuilder();
      const content = builder.build();

      expect(content).toHaveProperty('object');
      expect(content).toHaveProperty('type');
    });

    it('should handle undefined optional properties', () => {
      const builder = new TestBlockBuilder();
      const content = builder.build();

      expect(content.test_block).toBeDefined();
      expect(content.children).toBeUndefined();
      expect(content.has_children).toBeFalsy();
    });
  });

  describe('builder chaining', () => {
    it('should support method chaining', () => {
      const builder = new TestBlockBuilder();
      const result = builder
        .setColor('blue')
        .addChild(new ParagraphBuilder().setText('Child'))
        .build();

      expect(result.test_block.color).toBe('blue');
      expect(result.children).toBeDefined();
      expect(result.children).toHaveLength(1);
    });
  });
}); 