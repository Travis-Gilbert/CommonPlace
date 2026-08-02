// SOURCING: twenty-ui CodeEditor theme (this fork). TU7: the theme values are
// CommonPlace register references now, so the display-p3 string parser is
// replaced by a resolver that asks the browser (see ./resolveCssColor).
import { type ThemeType } from '@ui/theme-constants';
import { type editor } from 'monaco-editor';
import { resolveCssColor } from '@ui/input/CodeEditor/utils/resolveCssColor';

export const getBaseCodeEditorTheme = (
  theme: ThemeType,
  colorScheme: 'light' | 'dark',
  /** The editor's own element, so the light register resolves under it. */
  container?: HTMLElement | null,
): editor.IStandaloneThemeData => {
  const convertColorToHex = (color: string) => resolveCssColor(color, container);

  return {
    base: colorScheme === 'dark' ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      {
        token: '',
        foreground: convertColorToHex(theme.font.color.secondary),
      },
      {
        token: 'keyword',
        foreground: convertColorToHex(theme.color.pink11),
      },
      {
        token: 'keyword.control',
        foreground: convertColorToHex(theme.color.pink11),
      },
      {
        token: 'keyword.json',
        foreground: convertColorToHex(theme.color.orange11),
      },
      {
        token: 'number',
        foreground: convertColorToHex(theme.color.orange11),
      },
      {
        token: 'number.json',
        foreground: convertColorToHex(theme.color.orange11),
      },
      {
        token: 'regexp',
        foreground: convertColorToHex(theme.color.orange11),
      },
      {
        token: 'type',
        foreground: convertColorToHex(theme.color.green11),
      },
      {
        token: 'attribute.name',
        foreground: convertColorToHex(theme.color.blue11),
      },
      {
        token: 'tag',
        foreground: convertColorToHex(theme.color.pink11),
      },
      {
        token: 'string',
        foreground: convertColorToHex(theme.color.green11),
      },
      {
        token: 'string.key.json',
        foreground: convertColorToHex(theme.color.blue11),
      },
      {
        token: 'delimiter',
        foreground: convertColorToHex(theme.font.color.light),
      },
      {
        token: 'delimiter.bracket.json',
        foreground: convertColorToHex(theme.font.color.light),
      },
      {
        token: 'string.value.json',
        foreground: convertColorToHex(theme.color.green11),
      },
      {
        token: 'comment',
        foreground: convertColorToHex(theme.font.color.light),
        fontStyle: 'italic',
      },
    ],
    colors: {
      'editor.background': convertColorToHex('transparent'),
      'editor.foreground': convertColorToHex(theme.font.color.secondary),
      'editorCursor.foreground': convertColorToHex(theme.font.color.primary),
      'editorLineNumber.foreground': convertColorToHex(
        theme.font.color.extraLight,
      ),
      'editorLineNumber.activeForeground': convertColorToHex(
        theme.font.color.light,
      ),
      'editor.lineHighlightBackground': convertColorToHex(
        theme.background.tertiary,
      ),
      'editor.selectionBackground': convertColorToHex(
        theme.background.transparent.blue,
      ),
      'editor.inactiveSelectionBackground': convertColorToHex(
        theme.background.transparent.light,
      ),
      'editorIndentGuide.background1': convertColorToHex(
        theme.border.color.light,
      ),
      'editorIndentGuide.activeBackground1': convertColorToHex(
        theme.border.color.medium,
      ),
      'editorBracketMatch.background': convertColorToHex(
        theme.background.transparent.light,
      ),
      'editorBracketMatch.border': convertColorToHex(theme.border.color.medium),
    },
  };
};
