import { getCurrentUrlWithQueryParams, MenuLink } from '../shared/link';
import { FileContents, LoaderOptions, loadFile } from '../shared/loader';
import { MarkdownHeading, getHeadings } from '../shared/markdown';

const sectionSeparator = /(?:\n\n|\r\n\r\n)(?:---|===)(?:\n\n|\r\n\r\n)/;

export interface WorkshopSection {
  title: string;
  headings: MarkdownHeading[];
  markdown: string;
}

export interface WorkshopExtraMetadata {
  navigation_levels: number;
  navigation_numbering: boolean;
}

export interface Workshop extends FileContents<WorkshopExtraMetadata> {
  title: string;
  shortTitle?: string;
  sections: WorkshopSection[];
  step: number;
}

export async function loadWorkshop(repoPath: string, options?: LoaderOptions): Promise<Workshop> {
  const fileContents = await loadFile<WorkshopExtraMetadata>(repoPath, options);
  const sections = fileContents.markdown.split(sectionSeparator).map((markdown, index) => {
    const headings = getHeadings(markdown);
    const title = fileContents.meta.sections_title?.[index] ?? headings[0]?.text ?? '';

    if (headings.length && headings[0].level !== 1) {
      // If we're missing the top-level heading, then add one using the title
      markdown = `<h1 class="visually-hidden">${fileContents.meta.title}</h1>\n\n${markdown}`;
    }

    // Replace the specific content for [!NOTE]
    markdown = markdown.replace(
      /> \[!NOTE]\n(> .*\n)*/g,
      (match) => {
        const contentWithoutNoteTag = match.replace(/> \[!NOTE]\n/, '');
        return `<div class="task" data-title="note">\n\n${contentWithoutNoteTag}\n</div>\n`;
      }
    );

    // Replace the specific content for [!HELP]
    markdown = markdown.replace(
      /> \[!HELP]\n(> .*\n)*/g,
      (match) => {
        const contentWithoutHelpTag = match.replace(/> \[!HELP]\n/, '');
        return `<div class="warning" data-title="help">\n\n${contentWithoutHelpTag}\n</div>\n`;
      }
    );

    // Replace the specific content for [!ALERT]
    markdown = markdown.replace(
      /> \[!ALERT]\n(> .*\n)*/g,
      (match) => {
        const contentWithoutAlertTag = match.replace(/> \[!ALERT]\n/, '');
        return `<div class="important" data-title="important">\n\n${contentWithoutAlertTag}\n</div>\n`;
      }
    );

    // Replace the specific content for [!HINT]
    markdown = markdown.replace(
      /> \[!HINT]\n(> .*\n)*/g,
      (match) => {
        const contentWithoutHintTag = match.replace(/> \[!HINT]\n/, '');
        return `<div class="tip" data-title="hint">\n\n${contentWithoutHintTag}\n</div>\n`;
      }
    );

    // Replace the specific content for [!TIP]
    markdown = markdown.replace(
      /> \[!TIP]\n(> .*\n)*/g,
      (match) => {
        const contentWithoutTipTag = match.replace(/> \[!TIP]\n/, '');
        return `<div class="tip" data-title="tip">\n\n${contentWithoutTipTag}\n</div>\n`;
      }
    );

    // Replace the specific content for [!KNOWLEDGE]
    markdown = markdown.replace(
      /> \[!KNOWLEDGE]\n(> .*\n)*/g,
      (match) => {
        const contentWithoutKnowledgeTag = match.replace(/> \[!KNOWLEDGE]\n/, '');
        return `<div class="tip" data-title="knowledge">\n\n${contentWithoutKnowledgeTag}\n</div>\n`;
      }
    );

    return { title, headings, markdown };
  });
  return {
    ...fileContents,
    title: fileContents.meta.title ?? sections[0].title,
    shortTitle: fileContents.meta.short_title,
    sections,
    step: 0
  };
}

export function createMenuLinks(workshop: Workshop): MenuLink[] {
  const navigationLevels = workshop.meta?.navigation_levels ?? 2;
  return workshop.sections.map((section, index) => {
    const active = index === workshop.step;
    const baseLevel = section.headings[0].level;
    const allowedLevels = baseLevel + Math.max(navigationLevels - 1, 0);
    const children = section.headings
      .slice(1)
      .filter((heading) => heading.level <= allowedLevels)
      .map((heading) => ({
        active: false,
        text: heading.text,
        url: heading.url,
        level: heading.level - baseLevel
      }));
    return {
      active,
      text: section.title,
      url: getCurrentUrlWithQueryParams({ step: index }),
      children,
      level: 0
    };
  });
}
