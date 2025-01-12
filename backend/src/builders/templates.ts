import { NotionBuilderFactory } from './factory';
import type { DatabasePageBuilder } from './page-builders';

export interface DocumentationPageOptions {
  title: string;
  description: string;
  sections: Array<{
    title: string;
    content: string;
  }>;
  status?: string;
  tags?: string[];
  owner?: string;
}

export interface MeetingNotesOptions {
  title: string;
  date: string;
  attendees: string[];
  agenda: string[];
  decisions?: string[];
  actionItems?: Array<{
    task: string;
    assignee: string;
    dueDate?: string;
  }>;
}

export interface ProjectTrackerOptions {
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  status?: string;
  priority?: string;
  owner?: string;
  team?: string[];
  milestones?: Array<{
    title: string;
    dueDate: string;
    description?: string;
  }>;
}

/**
 * Template factory for common Notion content patterns
 */
export const NotionTemplates = {
  /**
   * Creates a documentation page with standardized structure
   */
  documentationPage(databaseId: string, options: DocumentationPageOptions): DatabasePageBuilder {
    const page = NotionBuilderFactory.databasePage(databaseId)
      .setTitle(options.title)
      .setRichText('Description', options.description);

    if (options.status) {
      page.setStatus('Status', options.status);
    }

    if (options.tags) {
      page.setMultiSelect('Tags', options.tags);
    }

    if (options.owner) {
      page.setRichText('Owner', options.owner);
    }

    // Add table of contents
    page.addChild(NotionBuilderFactory.tableOfContents());

    // Add sections
    for (const section of options.sections) {
      page
        .addChild(NotionBuilderFactory.heading(2, section.title))
        .addChild(NotionBuilderFactory.paragraph(section.content));
    }

    return page;
  },

  /**
   * Creates a meeting notes page with standardized structure
   */
  meetingNotes(databaseId: string, options: MeetingNotesOptions): DatabasePageBuilder {
    const page = NotionBuilderFactory.databasePage(databaseId)
      .setTitle(options.title)
      .setDate('Date', options.date)
      .setMultiSelect('Attendees', options.attendees);

    // Add agenda section
    page
      .addChild(NotionBuilderFactory.heading(2, 'Agenda'))
      .addChild(
        NotionBuilderFactory.toggle('Click to expand')
          .addChild(NotionBuilderFactory.bulletedListItem(options.agenda.join('\n')))
      );

    // Add decisions section if provided
    if (options.decisions?.length) {
      page
        .addChild(NotionBuilderFactory.heading(2, 'Key Decisions'))
        .addChild(
          NotionBuilderFactory.callout('Important decisions made during the meeting')
            .setIcon('🎯')
        );

      for (const decision of options.decisions) {
        page.addChild(NotionBuilderFactory.bulletedListItem(decision));
      }
    }

    // Add action items section if provided
    if (options.actionItems?.length) {
      page.addChild(NotionBuilderFactory.heading(2, 'Action Items'));

      for (const item of options.actionItems) {
        const text = `${item.task} (Assignee: ${item.assignee}${item.dueDate ? `, Due: ${item.dueDate}` : ''})`;
        page.addChild(NotionBuilderFactory.toDo(text));
      }
    }

    return page;
  },

  /**
   * Creates a project tracker page with standardized structure
   */
  projectTracker(databaseId: string, options: ProjectTrackerOptions): DatabasePageBuilder {
    const page = NotionBuilderFactory.databasePage(databaseId)
      .setTitle(options.title)
      .setRichText('Description', options.description)
      .setDate('Timeline', options.startDate, options.endDate);

    if (options.status) {
      page.setStatus('Status', options.status);
    }

    if (options.priority) {
      page.setSelect('Priority', options.priority);
    }

    if (options.owner) {
      page.setRichText('Owner', options.owner);
    }

    if (options.team) {
      page.setMultiSelect('Team', options.team);
    }

    // Add overview section
    page
      .addChild(NotionBuilderFactory.heading(2, 'Project Overview'))
      .addChild(NotionBuilderFactory.paragraph(options.description))
      .addChild(NotionBuilderFactory.divider());

    // Add milestones section if provided
    if (options.milestones?.length) {
      page.addChild(NotionBuilderFactory.heading(2, 'Milestones'));

      const table = NotionBuilderFactory.table(3, true)
        .addRow(['Milestone', 'Due Date', 'Description']);

      for (const milestone of options.milestones) {
        table.addRow([
          milestone.title,
          milestone.dueDate,
          milestone.description || ''
        ]);
      }

      page.addChild(table);
    }

    return page;
  }
}; 