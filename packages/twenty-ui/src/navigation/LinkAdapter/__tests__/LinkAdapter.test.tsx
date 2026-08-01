// SOURCING: none — pure logic, no upstream component applies. The TU3 oracle.
//
// Two claims the router seam makes, both otherwise only inspectable by eye:
// the adapter renders a real anchor with the destination on `href` (so
// LinkChip and the button family navigate client-side), and the testing
// decorators mount with no router provider anywhere in the tree.

import { render, screen } from '@testing-library/react';

import { LinkAdapter } from '../LinkAdapter';
import { ComponentWithRouterDecorator } from '@ui/testing/decorators/ComponentWithRouterDecorator';
import { RouterDecorator } from '@ui/testing/decorators/RouterDecorator';

describe('LinkAdapter', () => {
  it('maps the upstream `to` prop onto an anchor href', () => {
    render(<LinkAdapter to="/records/abc">Open</LinkAdapter>);
    const link = screen.getByRole('link', { name: 'Open' });
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/records/abc');
  });

  it('renders an inert anchor when there is no destination', () => {
    // The polymorphic call sites pass `to` conditionally; the branch has to be
    // total or a button-shaped Button would crash when it has no link.
    render(<LinkAdapter>No destination</LinkAdapter>);
    expect(screen.getByText('No destination').tagName).toBe('A');
  });

  it('drops `disabled`, which is not a valid anchor attribute', () => {
    render(
      <LinkAdapter to="/x" disabled>
        Disabled
      </LinkAdapter>,
    );
    expect(screen.getByRole('link').hasAttribute('disabled')).toBe(false);
  });

  it('forwards the rest of the anchor props', () => {
    render(
      <LinkAdapter to="https://example.com" target="_blank" rel="noopener noreferrer">
        External
      </LinkAdapter>,
    );
    const link = screen.getByRole('link');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });
});

describe('testing decorators', () => {
  const Story = () => <p>story body</p>;
  const context = { args: {}, parameters: {} };

  it('RouterDecorator mounts with no router provider', () => {
    render(RouterDecorator(Story, context));
    expect(screen.getByText('story body')).toBeInTheDocument();
  });

  it('ComponentWithRouterDecorator mounts with no router provider', () => {
    render(ComponentWithRouterDecorator(Story, context));
    expect(screen.getByText('story body')).toBeInTheDocument();
  });
});
