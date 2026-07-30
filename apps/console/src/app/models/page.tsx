// SOURCING: none. Compatibility route for the former Models path.
import { permanentRedirect } from 'next/navigation';

export default function LegacyModelsPage() {
  permanentRedirect('/Data-model');
}
