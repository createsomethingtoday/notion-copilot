import { PageBuilder } from './content-builder';

/**
 * Database page builder
 */
export class DatabasePageBuilder extends PageBuilder {
  constructor(databaseId: string) {
    super();
    this.setParent('database_id', databaseId);
  }

  /**
   * Sets a title property
   */
  setTitle(title: string): this {
    return this.addProperty('title', {
      title: this.createRichText(title)
    });
  }

  /**
   * Sets a rich text property
   */
  setRichText(key: string, text: string): this {
    return this.addProperty(key, {
      rich_text: this.createRichText(text)
    });
  }

  /**
   * Sets a number property
   */
  setNumber(key: string, value: number): this {
    return this.addProperty(key, { number: value });
  }

  /**
   * Sets a select property
   */
  setSelect(key: string, value: string): this {
    return this.addProperty(key, {
      select: { name: value }
    });
  }

  /**
   * Sets a multi-select property
   */
  setMultiSelect(key: string, values: string[]): this {
    return this.addProperty(key, {
      multi_select: values.map(name => ({ name }))
    });
  }

  /**
   * Sets a date property
   */
  setDate(key: string, start: string, end?: string, timeZone?: string): this {
    return this.addProperty(key, {
      date: { start, end, time_zone: timeZone }
    });
  }

  /**
   * Sets a checkbox property
   */
  setCheckbox(key: string, checked: boolean): this {
    return this.addProperty(key, { checkbox: checked });
  }

  /**
   * Sets a URL property
   */
  setUrl(key: string, url: string): this {
    return this.addProperty(key, { url });
  }

  /**
   * Sets an email property
   */
  setEmail(key: string, email: string): this {
    return this.addProperty(key, { email });
  }

  /**
   * Sets a phone number property
   */
  setPhoneNumber(key: string, phoneNumber: string): this {
    return this.addProperty(key, { phone_number: phoneNumber });
  }

  /**
   * Sets a relation property
   */
  setRelation(key: string, pageIds: string[]): this {
    return this.addProperty(key, {
      relation: pageIds.map(id => ({ id }))
    });
  }

  /**
   * Sets a status property
   */
  setStatus(key: string, status: string): this {
    return this.addProperty(key, {
      status: { name: status }
    });
  }
}

/**
 * Child page builder
 */
export class ChildPageBuilder extends PageBuilder {
  constructor(parentId: string) {
    super();
    this.setParent('page_id', parentId);
  }

  /**
   * Sets the page title
   */
  setTitle(title: string): this {
    return this.addProperty('title', {
      title: this.createRichText(title)
    });
  }
} 