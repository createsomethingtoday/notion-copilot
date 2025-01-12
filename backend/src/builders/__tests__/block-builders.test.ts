import {
  ParagraphBuilder,
  HeadingBuilder,
  BulletedListBuilder,
  NumberedListBuilder,
  ToDoBuilder,
  ToggleBuilder,
  CodeBuilder,
  QuoteBuilder,
  DividerBuilder,
  CalloutBuilder,
  TableBuilder
} from '../block-builders';

describe('Block Builders', () => {
  describe('ParagraphBuilder', () => {
    it('should create a valid paragraph block', () => {
      const builder = new ParagraphBuilder();
      const block = builder.setText('Hello world').build();

      expect(block).toEqual({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            type: 'text',
            text: { content: 'Hello world' }
          }]
        }
      });
    });

    it('should support text formatting options', () => {
      const builder = new ParagraphBuilder();
      const block = builder.setText('Formatted text', {
        bold: true,
        italic: true,
        color: 'red'
      }).build();

      expect(block.paragraph.rich_text[0]).toMatchObject({
        annotations: {
          bold: true,
          italic: true,
          color: 'red'
        }
      });
    });
  });

  describe('HeadingBuilder', () => {
    it.each([1, 2, 3])('should create a valid heading_%d block', (level) => {
      const builder = new HeadingBuilder(level as 1 | 2 | 3);
      const block = builder.setText(`Heading ${level}`).build();

      expect(block).toEqual({
        object: 'block',
        type: `heading_${level}`,
        [`heading_${level}`]: {
          rich_text: [{
            type: 'text',
            text: { content: `Heading ${level}` }
          }]
        }
      });
    });
  });

  describe('BulletedListBuilder', () => {
    it('should create a valid bulleted list item', () => {
      const builder = new BulletedListBuilder();
      const block = builder.setText('List item').build();

      expect(block).toEqual({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{
            type: 'text',
            text: { content: 'List item' }
          }]
        }
      });
    });
  });

  describe('ToDoBuilder', () => {
    it('should create a valid to-do block with checked state', () => {
      const builder = new ToDoBuilder();
      const block = builder
        .setText('Task')
        .setChecked(true)
        .build();

      expect(block).toEqual({
        object: 'block',
        type: 'to_do',
        to_do: {
          rich_text: [{
            type: 'text',
            text: { content: 'Task' }
          }],
          checked: true
        }
      });
    });
  });

  describe('TableBuilder', () => {
    it('should create a valid table with correct column count', () => {
      const builder = new TableBuilder(2);
      const block = builder
        .setHasColumnHeader(true)
        .addRow(['Header 1', 'Header 2'])
        .addRow(['Cell 1', 'Cell 2'])
        .build();

      expect(block).toEqual({
        object: 'block',
        type: 'table',
        table: {
          table_width: 2,
          has_column_header: true,
          has_row_header: false,
          children: [
            {
              type: 'table_row',
              table_row: {
                cells: [
                  [{ type: 'text', text: { content: 'Header 1' } }],
                  [{ type: 'text', text: { content: 'Header 2' } }]
                ]
              }
            },
            {
              type: 'table_row',
              table_row: {
                cells: [
                  [{ type: 'text', text: { content: 'Cell 1' } }],
                  [{ type: 'text', text: { content: 'Cell 2' } }]
                ]
              }
            }
          ]
        }
      });
    });

    it('should validate table row cell count', () => {
      const builder = new TableBuilder(2);
      expect(() => {
        builder.addRow(['Single Cell']).build();
      }).toThrow('Invalid number of cells');
    });
  });

  // Add more test cases for other builders...
}); 