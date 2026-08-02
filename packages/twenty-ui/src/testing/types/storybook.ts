// SOURCING: none — pure logic, no upstream component applies. Structural type
// shim for the @storybook/react-vite types the testing module referenced.
//
// The fork dropped Storybook with the 156 stories (TU1) but kept the testing
// decorators, which are useful as plain render wrappers in any harness. These
// aliases are the shapes those decorators actually rely on, so the module
// compiles and mounts with no Storybook install and no router provider.
//
// `parameters` and `args` are deliberately open records: the decorators read
// caller-supplied keys (`catalog`, `container`) that no shared type can know.

import { type JSX } from 'react';

export type StrictArgs = { [name: string]: unknown };

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Parameters = Record<string, any>;

export type DecoratorContext = {
  args: StrictArgs;
  parameters: Parameters;
};

/**
 * A render wrapper: takes the story component, returns the wrapped element.
 * The story accepts an optional `args` override, which CatalogDecorator uses to
 * render one cell per dimension combination.
 */
export type Decorator = (
  Story: (props?: { args?: StrictArgs }) => JSX.Element,
  context: DecoratorContext,
) => JSX.Element;

export type StoryObj<T = unknown> = {
  args?: Partial<T> & StrictArgs;
  argTypes?: Record<string, any>;
  play?: (context: DecoratorContext) => void | Promise<void>;
  parameters?: Parameters;
  decorators?: Decorator[];
  render?: (args: StrictArgs) => JSX.Element;
};
