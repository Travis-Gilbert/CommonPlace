// SOURCING: none — pure logic, no upstream component applies. TU3 removed the
// react-router createMemoryRouter this wrapped.
//
// The route-path helpers survive because they are pure string work that call
// sites still use to compute the location a component believes it is rendered
// at. The provider does not: under Next's App Router there is nothing to mount,
// so the decorator wraps the story in the same layout and renders it directly.

import { type JSX } from 'react';

import { ComponentStorybookLayout } from '../ComponentStorybookLayout';
import { type Decorator } from '../types/storybook';

export type RouteParams = {
  [param: string]: string;
};

export const isRouteParams = (obj: any): obj is RouteParams => {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  return Object.keys(obj).every((key) => typeof obj[key] === 'string');
};

export const computeLocation = (
  routePath: string,
  routeParams?: RouteParams,
) => {
  return {
    pathname: routePath.replace(
      /:(\w+)/g,
      (paramName) => routeParams?.[paramName] ?? '',
    ),
  };
};

export const ComponentWithRouterDecorator: Decorator = (
  Story: () => JSX.Element,
) => (
  <ComponentStorybookLayout>
    <Story />
  </ComponentStorybookLayout>
);
