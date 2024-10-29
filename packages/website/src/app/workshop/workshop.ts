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

    function replaceMarkdownTag(markdown: string, tag: string, className: string, dataTitle: string): string {
      const regex = new RegExp(`> \\[!${tag}]\\n(> .*\\n)*`, 'gi');
      return markdown.replace(regex, (match) => {
        const contentWithoutTag = match.replace(new RegExp(`> \\[!${tag}]\\n`, 'i'), '');
        return `<div class="${className}" data-title="${dataTitle}">\n\n${contentWithoutTag}\n</div>\n`;
      });
    }

    markdown = replaceMarkdownTag(markdown, 'KNOWLEDGE', 'tip', 'knowledge');
    markdown = replaceMarkdownTag(markdown, 'ALERT', 'important', 'alert');
    markdown = replaceMarkdownTag(markdown, 'NOTE', 'task', 'note');
    markdown = replaceMarkdownTag(markdown, 'HELP', 'warning', 'help');
    markdown = replaceMarkdownTag(markdown, 'HINT', 'tip', 'hint');

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
