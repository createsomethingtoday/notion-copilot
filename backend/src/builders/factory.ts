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
  TableBuilder,
  TableOfContentsBuilder
} from './block-builders';
import {
  DatabasePageBuilder,
  ChildPageBuilder
} from './page-builders';

/**
 * Factory for creating Notion content builders
 */
export const NotionBuilderFactory = {
  /**
   * Creates a database page builder
   */
  databasePage(databaseId: string): DatabasePageBuilder {
    return new DatabasePageBuilder(databaseId);
  },

  /**
   * Creates a child page builder
   */
  childPage(parentId: string): ChildPageBuilder {
    return new ChildPageBuilder(parentId);
  },

  /**
   * Creates a paragraph block builder
   */
  paragraph(text: string): ParagraphBuilder {
    return new ParagraphBuilder(text);
  },

  /**
   * Creates a heading block builder
   */
  heading(level: 1 | 2 | 3, text: string): HeadingBuilder {
    return new HeadingBuilder(level, text);
  },

  /**
   * Creates a bulleted list item builder
   */
  bulletedListItem(text: string): BulletedListBuilder {
    return new BulletedListBuilder(text);
  },

  /**
   * Creates a numbered list item builder
   */
  numberedListItem(text: string): NumberedListBuilder {
    return new NumberedListBuilder(text);
  },

  /**
   * Creates a to-do block builder
   */
  toDo(text: string, checked = false): ToDoBuilder {
    return new ToDoBuilder(text, checked);
  },

  /**
   * Creates a toggle block builder
   */
  toggle(text: string): ToggleBuilder {
    return new ToggleBuilder(text);
  },

  /**
   * Creates a code block builder
   */
  code(code: string, language: string): CodeBuilder {
    return new CodeBuilder(code, language);
  },

  /**
   * Creates a quote block builder
   */
  quote(text: string): QuoteBuilder {
    return new QuoteBuilder(text);
  },

  /**
   * Creates a divider block builder
   */
  divider(): DividerBuilder {
    return new DividerBuilder();
  },

  /**
   * Creates a callout block builder
   */
  callout(text: string): CalloutBuilder {
    return new CalloutBuilder(text);
  },

  /**
   * Creates a table block builder
   */
  table(width: number, hasColumnHeader = false, hasRowHeader = false): TableBuilder {
    return new TableBuilder(width, hasColumnHeader, hasRowHeader);
  },

  /**
   * Creates a table of contents block builder
   */
  tableOfContents(): TableOfContentsBuilder {
    return new TableOfContentsBuilder();
  }
} as const; 