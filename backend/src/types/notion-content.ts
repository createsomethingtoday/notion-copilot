import type { 
  CreatePageParameters,
  UpdatePageParameters,
  BlockObjectRequest,
  UpdateBlockParameters
} from '@notionhq/client/build/src/api-endpoints';

/**
 * Rich text content
 */
export interface NotionRichText {
  type: 'text';
  text: {
    content: string;
    link?: { url: string };
  };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
}

/**
 * Page property values
 */
export interface NotionPropertyValue {
  title?: NotionRichText[];
  rich_text?: NotionRichText[];
  number?: number;
  select?: { name: string };
  multi_select?: { name: string }[];
  date?: {
    start: string;
    end?: string;
    time_zone?: string;
  };
  checkbox?: boolean;
  url?: string;
  email?: string;
  phone_number?: string;
  relation?: { id: string }[];
  status?: { name: string };
}

/**
 * Page properties
 */
export interface NotionProperties {
  [key: string]: NotionPropertyValue;
}

/**
 * Page content for creation
 */
export interface NotionPageContent {
  parent: {
    type: 'database_id' | 'page_id';
    database_id?: string;
    page_id?: string;
  };
  properties: NotionProperties;
  children?: NotionBlockContent[];
  icon?: {
    type: 'emoji';
    emoji: string;
  } | {
    type: 'external';
    external: { url: string };
  };
  cover?: {
    type: 'external';
    external: { url: string };
  };
}

/**
 * Block content types
 */
export type NotionBlockContent = 
  | NotionParagraphBlock
  | NotionHeadingBlock
  | NotionBulletedListBlock
  | NotionNumberedListBlock
  | NotionToDoBlock
  | NotionToggleBlock
  | NotionCodeBlock
  | NotionQuoteBlock
  | NotionDividerBlock
  | NotionCalloutBlock
  | NotionTableBlock
  | NotionTableOfContentsBlock
  | NotionTestBlock;

/**
 * Base block interface
 */
interface NotionBaseBlock {
  object: 'block';
  children?: NotionBlockContent[];
}

/**
 * Paragraph block
 */
export interface NotionParagraphBlock extends NotionBaseBlock {
  type: 'paragraph';
  paragraph: {
    rich_text: NotionRichText[];
    color?: string;
  };
}

/**
 * Heading blocks
 */
export interface NotionHeadingBlock extends NotionBaseBlock {
  type: 'heading_1' | 'heading_2' | 'heading_3';
  heading_1?: {
    rich_text: NotionRichText[];
    color?: string;
  };
  heading_2?: {
    rich_text: NotionRichText[];
    color?: string;
  };
  heading_3?: {
    rich_text: NotionRichText[];
    color?: string;
  };
}

/**
 * Bulleted list block
 */
export interface NotionBulletedListBlock extends NotionBaseBlock {
  type: 'bulleted_list_item';
  bulleted_list_item: {
    rich_text: NotionRichText[];
    color?: string;
  };
}

/**
 * Numbered list block
 */
export interface NotionNumberedListBlock extends NotionBaseBlock {
  type: 'numbered_list_item';
  numbered_list_item: {
    rich_text: NotionRichText[];
    color?: string;
  };
}

/**
 * To-do block
 */
export interface NotionToDoBlock extends NotionBaseBlock {
  type: 'to_do';
  to_do: {
    rich_text: NotionRichText[];
    checked: boolean;
    color?: string;
  };
}

/**
 * Toggle block
 */
export interface NotionToggleBlock extends NotionBaseBlock {
  type: 'toggle';
  toggle: {
    rich_text: NotionRichText[];
    color?: string;
  };
}

/**
 * Code block
 */
export interface NotionCodeBlock extends NotionBaseBlock {
  type: 'code';
  code: {
    rich_text: NotionRichText[];
    language: string;
    caption?: NotionRichText[];
  };
}

/**
 * Quote block
 */
export interface NotionQuoteBlock extends NotionBaseBlock {
  type: 'quote';
  quote: {
    rich_text: NotionRichText[];
    color?: string;
  };
}

/**
 * Divider block
 */
export interface NotionDividerBlock extends NotionBaseBlock {
  type: 'divider';
  divider: Record<string, never>;
}

/**
 * Callout block
 */
export interface NotionCalloutBlock extends NotionBaseBlock {
  type: 'callout';
  callout: {
    rich_text: NotionRichText[];
    icon?: {
      type: 'emoji';
      emoji: string;
    } | {
      type: 'external';
      external: { url: string };
    };
    color?: string;
  };
}

/**
 * Table block
 */
export interface NotionTableBlock extends NotionBaseBlock {
  type: 'table';
  table: {
    table_width: number;
    has_column_header: boolean;
    has_row_header: boolean;
    children: {
      type: 'table_row';
      table_row: {
        cells: NotionRichText[][];
      };
    }[];
  };
}

export interface NotionTableOfContentsBlock {
  type: 'table_of_contents';
  table_of_contents: Record<string, never>;
}

export interface NotionTestBlock {
  object: 'block';
  type: 'test_block';
  test_block: {
    color?: string;
  };
  has_children?: boolean;
  children?: NotionBlockContent[];
}

/**
 * Type guard for checking if content is a page
 */
export function isPageContent(content: unknown): content is NotionPageContent {
  const page = content as NotionPageContent;
  return (
    !!page &&
    typeof page === 'object' &&
    'parent' in page &&
    'properties' in page &&
    typeof page.properties === 'object'
  );
}

/**
 * Type guard for checking if content is a block
 */
export function isBlockContent(content: unknown): content is NotionBlockContent {
  const block = content as NotionBlockContent;
  return (
    !!block &&
    typeof block === 'object' &&
    'type' in block &&
    'object' in block &&
    block.object === 'block'
  );
}

/**
 * Converts our content types to Notion API types
 */
export function toNotionContent(
  content: NotionPageContent | NotionBlockContent
): CreatePageParameters | BlockObjectRequest {
  if (isPageContent(content)) {
    return content as unknown as CreatePageParameters;
  }
  if (isBlockContent(content)) {
    return content as unknown as BlockObjectRequest;
  }
  throw new Error('Invalid content type');
}

/**
 * Updates our content types to Notion API types
 */
export function toNotionUpdate(
  content: Partial<NotionPageContent> | Partial<NotionBlockContent>
): UpdatePageParameters | UpdateBlockParameters {
  if (isPageContent(content)) {
    return content as unknown as UpdatePageParameters;
  }
  if (isBlockContent(content)) {
    return content as unknown as UpdateBlockParameters;
  }
  throw new Error('Invalid content type');
} 