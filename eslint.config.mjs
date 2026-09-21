import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/**
 * Owner rule (2026-09-13): the dashboard never uses plain HTML controls — always
 * a shadcn component from components/ui, themed with BOBR colours.
 *
 * Enforced here rather than remembered: an AST rule sees `<input` even when it
 * sits alone at the end of a line, which the first grep for this missed.
 * Layout and text elements (div, section, main, ul, li, h1–h3, p, span) stay
 * semantic HTML — shadcn itself has no heading or text primitives.
 */
const SHADCN_INSTEAD = {
  button: 'Button',
  input: 'Input / Checkbox',
  select: 'Select',
  textarea: 'Textarea',
  label: 'Label',
  table: 'Table',
  thead: 'TableHeader',
  tbody: 'TableBody',
  tr: 'TableRow',
  th: 'TableHead',
  td: 'TableCell',
  form: 'a component wrapper (see components/ui)',
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', '.claude/**']),
  {
    files: ['app/**/*.tsx'],
    rules: {
      'react/forbid-elements': [
        'error',
        {
          forbid: Object.entries(SHADCN_INSTEAD).map(([element, use]) => ({
            element,
            message: `use the shadcn ${use} from @/components/ui instead of a plain <${element}>`,
          })),
        },
      ],
    },
  },
  {
    rules: {
      // Deliberately-unused bindings are marked with a leading underscore.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
]);

export default eslintConfig;
