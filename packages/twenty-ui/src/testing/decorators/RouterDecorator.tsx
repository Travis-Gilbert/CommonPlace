// SOURCING: none — pure logic, no upstream component applies. TU3 removed the
// react-router MemoryRouter this wrapped.
//
// Next's App Router has no in-memory provider to mount: `next/link` and
// `useRouter` read the router the app already established, and outside one the
// LinkAdapter still renders a working anchor. So the decorator becomes a
// pass-through. It is kept rather than deleted because call sites compose
// decorator lists positionally, and because "mounts without a router provider"
// is exactly the property TU3 asserts.

import { type Decorator } from '../types/storybook';

export const RouterDecorator: Decorator = (Story) => <Story />;
