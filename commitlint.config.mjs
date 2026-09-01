/**
 * Conventional Commits enforced via commitlint (run by the Husky commit-msg hook).
 * Examples:
 *   feat(pousadas): add availability calendar
 *   fix(header): correct mobile menu aria state
 *   chore(deps): bump next to 16.2.6
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'subject-case': [0],
  },
}
