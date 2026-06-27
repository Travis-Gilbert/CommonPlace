```markdown
# CommonPlace Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns used in the CommonPlace TypeScript repository. You'll learn the project's coding conventions, including file naming, import/export styles, commit message structure, and testing patterns. This guide also provides workflow templates and command suggestions to streamline your development process.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `userProfile.ts`, `dataFetcher.ts`

### Imports
- Use **alias imports** to reference modules.
  - Example:
    ```typescript
    import { fetchData as getData } from './dataFetcher';
    ```

### Exports
- Use **named exports** for modules and functions.
  - Example:
    ```typescript
    // In userProfile.ts
    export function getUserProfile(id: string) { ... }
    export const USER_ROLE = 'admin';
    ```

### Commit Messages
- Follow **conventional commit** format.
- Use the `fix` prefix for bug fixes.
- Keep commit messages concise (average 50 characters).
  - Example:
    ```
    fix: resolve user profile loading error
    ```

## Workflows

### Fixing a Bug
**Trigger:** When you need to resolve a bug in the codebase  
**Command:** `/fix-bug`

1. Identify the bug and locate the relevant file(s).
2. Create a new branch for your fix.
3. Apply the fix using camelCase file naming and alias imports as needed.
4. Write or update a corresponding test (`*.test.*`).
5. Commit your changes using the `fix:` prefix.
    ```bash
    git commit -m "fix: correct data fetch logic"
    ```
6. Push your branch and open a pull request.

### Adding a New Module
**Trigger:** When you need to add a new feature or module  
**Command:** `/add-module`

1. Create a new file using camelCase naming.
    ```bash
    touch newFeature.ts
    ```
2. Implement your module using named exports.
    ```typescript
    export function newFeature() { ... }
    ```
3. Use alias imports if importing from other modules.
4. Add a corresponding test file (`newFeature.test.ts`).
5. Commit your changes with a descriptive message.
    ```bash
    git commit -m "feat: add new feature module"
    ```
6. Push and open a pull request.

## Testing Patterns

- Test files follow the `*.test.*` pattern, e.g., `userProfile.test.ts`.
- The specific testing framework is not detected; follow existing patterns in the repo.
- Place tests alongside or near the modules they test.

  Example:
  ```typescript
  // userProfile.test.ts
  import { getUserProfile } from './userProfile';

  test('returns correct user profile', () => {
    expect(getUserProfile('123')).toEqual({ id: '123', name: 'Alice' });
  });
  ```

## Commands
| Command      | Purpose                                      |
|--------------|----------------------------------------------|
| /fix-bug     | Start the workflow for fixing a bug          |
| /add-module  | Start the workflow for adding a new module   |
```
