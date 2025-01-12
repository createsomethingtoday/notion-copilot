import type {
  NotionPageContent,
  NotionBlockContent,
  NotionRichText,
  NotionPropertyValue,
  NotionProperties
} from '../types/notion-content';
import { isPageContent, isBlockContent } from '../types/notion-content';

export class ValidationError extends Error {
  constructor(message: string, public details: string[]) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ContentValidator {
  /**
   * Validates page content
   */
  validatePageContent(content: unknown): asserts content is NotionPageContent {
    const errors: string[] = [];

    if (!isPageContent(content)) {
      throw new ValidationError('Invalid page content', ['Content must be a valid page object']);
    }

    // Validate parent
    if (!content.parent?.type) {
      errors.push('Parent type is required');
    } else if (!['database_id', 'page_id'].includes(content.parent.type)) {
      errors.push('Parent type must be either database_id or page_id');
    } else if (
      (content.parent.type === 'database_id' && !content.parent.database_id) ||
      (content.parent.type === 'page_id' && !content.parent.page_id)
    ) {
      errors.push(`${content.parent.type} is required when parent type is ${content.parent.type}`);
    }

    // Validate properties
    if (!content.properties || typeof content.properties !== 'object') {
      errors.push('Properties are required and must be an object');
    } else {
      this.validateProperties(content.properties, errors);
    }

    // Validate children if present
    if (content.children) {
      for (const [index, child] of content.children.entries()) {
        try {
          this.validateBlockContent(child);
        } catch (error) {
          if (error instanceof ValidationError) {
            errors.push(`Invalid child block at index ${index}: ${error.details.join(', ')}`);
          }
        }
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Page content validation failed', errors);
    }
  }

  /**
   * Validates block content
   */
  validateBlockContent(content: unknown): asserts content is NotionBlockContent {
    const errors: string[] = [];

    if (!isBlockContent(content)) {
      throw new ValidationError('Invalid block content', ['Content must be a valid block object']);
    }

    // Validate object type
    if (content.object !== 'block') {
      errors.push('Block object type must be "block"');
    }

    // Validate block type and content
    switch (content.type) {
      case 'paragraph':
        this.validateRichText(content.paragraph.rich_text, errors, 'paragraph');
        break;

      case 'heading_1':
      case 'heading_2':
      case 'heading_3': {
        const heading = content[content.type];
        if (heading) {
          this.validateRichText(heading.rich_text, errors, content.type);
        } else {
          errors.push(`${content.type} content is required`);
        }
        break;
      }

      case 'bulleted_list_item':
        this.validateRichText(content.bulleted_list_item.rich_text, errors, 'bulleted list item');
        break;

      case 'numbered_list_item':
        this.validateRichText(content.numbered_list_item.rich_text, errors, 'numbered list item');
        break;

      case 'to_do':
        this.validateRichText(content.to_do.rich_text, errors, 'to-do');
        if (typeof content.to_do.checked !== 'boolean') {
          errors.push('To-do checked property must be a boolean');
        }
        break;

      case 'toggle':
        this.validateRichText(content.toggle.rich_text, errors, 'toggle');
        break;

      case 'code':
        this.validateRichText(content.code.rich_text, errors, 'code');
        if (!content.code.language) {
          errors.push('Code language is required');
        }
        if (content.code.caption) {
          this.validateRichText(content.code.caption, errors, 'code caption');
        }
        break;

      case 'quote':
        this.validateRichText(content.quote.rich_text, errors, 'quote');
        break;

      case 'divider':
        // No additional validation needed
        break;

      case 'callout':
        this.validateRichText(content.callout.rich_text, errors, 'callout');
        if (content.callout.icon) {
          if (!['emoji', 'external'].includes(content.callout.icon.type)) {
            errors.push('Callout icon type must be either emoji or external');
          }
        }
        break;

      case 'table':
        if (!content.table.table_width || content.table.table_width < 1) {
          errors.push('Table width must be greater than 0');
        }
        if (typeof content.table.has_column_header !== 'boolean') {
          errors.push('Table has_column_header must be a boolean');
        }
        if (typeof content.table.has_row_header !== 'boolean') {
          errors.push('Table has_row_header must be a boolean');
        }
        if (!Array.isArray(content.table.children)) {
          errors.push('Table must have children array');
        } else {
          for (const [index, row] of content.table.children.entries()) {
            if (row.type !== 'table_row') {
              errors.push(`Table child at index ${index} must be a table_row`);
            } else if (!Array.isArray(row.table_row.cells)) {
              errors.push(`Table row at index ${index} must have cells array`);
            } else {
              for (const [cellIndex, cell] of row.table_row.cells.entries()) {
                try {
                  this.validateRichText(cell, errors, `cell at row ${index}, column ${cellIndex}`);
                } catch (error) {
                  if (error instanceof ValidationError) {
                    errors.push(...error.details);
                  }
                }
              }
            }
          }
        }
        break;

      default: {
        const unknownContent = content as { type: string };
        errors.push(`Unsupported block type: ${unknownContent.type}`);
      }
    }

    // Validate children if present
    if (content.children) {
      for (const [index, child] of content.children.entries()) {
        try {
          this.validateBlockContent(child);
        } catch (error) {
          if (error instanceof ValidationError) {
            errors.push(`Invalid child block at index ${index}: ${error.details.join(', ')}`);
          }
        }
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Block content validation failed', errors);
    }
  }

  /**
   * Validates rich text content
   */
  private validateRichText(
    richText: unknown,
    errors: string[],
    context: string
  ): asserts richText is NotionRichText[] {
    if (!Array.isArray(richText)) {
      errors.push(`${context} rich_text must be an array`);
      return;
    }

    richText.forEach((text, index) => {
      if (text.type !== 'text') {
        errors.push(`${context} rich_text[${index}] type must be "text"`);
      }
      if (!text.text?.content) {
        errors.push(`${context} rich_text[${index}] must have text content`);
      }
      if (text.text?.link && typeof text.text.link.url !== 'string') {
        errors.push(`${context} rich_text[${index}] link must have a valid URL`);
      }
    });
  }

  /**
   * Validates page properties
   */
  private validateProperties(
    properties: unknown,
    errors: string[]
  ): asserts properties is NotionProperties {
    if (typeof properties !== 'object' || !properties) {
      errors.push('Properties must be an object');
      return;
    }

    for (const [key, value] of Object.entries(properties as Record<string, NotionPropertyValue>)) {
      if (!value || typeof value !== 'object') {
        errors.push(`Property "${key}" must be an object`);
        return;
      }

      // Validate property value based on its type
      if ('title' in value) {
        this.validateRichText(value.title || [], errors, `property "${key}" title`);
      }
      if ('rich_text' in value) {
        this.validateRichText(value.rich_text || [], errors, `property "${key}" rich_text`);
      }
      if ('number' in value && value.number !== undefined && typeof value.number !== 'number') {
        errors.push(`Property "${key}" number must be a number`);
      }
      if ('select' in value && value.select && typeof value.select.name !== 'string') {
        errors.push(`Property "${key}" select must have a name string`);
      }
      if ('multi_select' in value && value.multi_select) {
        if (!Array.isArray(value.multi_select)) {
          errors.push(`Property "${key}" multi_select must be an array`);
        } else {
          for (const [index, select] of value.multi_select.entries()) {
            if (typeof select.name !== 'string') {
              errors.push(`Property "${key}" multi_select[${index}] must have a name string`);
            }
          }
        }
      }
      if ('date' in value && value.date) {
        if (typeof value.date.start !== 'string') {
          errors.push(`Property "${key}" date must have a start string`);
        }
        if (value.date.end !== undefined && typeof value.date.end !== 'string') {
          errors.push(`Property "${key}" date end must be a string`);
        }
      }
      if ('checkbox' in value && value.checkbox !== undefined && typeof value.checkbox !== 'boolean') {
        errors.push(`Property "${key}" checkbox must be a boolean`);
      }
      if ('url' in value && value.url !== undefined && typeof value.url !== 'string') {
        errors.push(`Property "${key}" URL must be a string`);
      }
      if ('email' in value && value.email !== undefined && typeof value.email !== 'string') {
        errors.push(`Property "${key}" email must be a string`);
      }
      if ('phone_number' in value && value.phone_number !== undefined && typeof value.phone_number !== 'string') {
        errors.push(`Property "${key}" phone number must be a string`);
      }
      if ('relation' in value && value.relation) {
        if (!Array.isArray(value.relation)) {
          errors.push(`Property "${key}" relation must be an array`);
        } else {
          for (const [index, relation] of value.relation.entries()) {
            if (typeof relation.id !== 'string') {
              errors.push(`Property "${key}" relation[${index}] must have an ID string`);
            }
          }
        }
      }
      if ('status' in value && value.status && typeof value.status.name !== 'string') {
        errors.push(`Property "${key}" status must have a name string`);
      }
    }
  }
} 