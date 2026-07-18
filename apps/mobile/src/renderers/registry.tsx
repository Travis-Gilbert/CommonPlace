import {
  bindViewRenderer,
  createViewRegistry,
  fieldOrganContracts,
  type ObjectRef,
  type ViewRenderProps,
} from '@commonplace/block-view';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { AgencyProposal } from '@/agency/types';
import { AppText } from '@/components/AppText';
import { ProposalCard } from '@/components/agency/ProposalCard';
import { useTheme } from '@/theme/ThemeProvider';

function firstObject({ set }: ViewRenderProps): ObjectRef | undefined {
  return set.objects[0];
}

function CompactCardRenderer(props: ViewRenderProps) {
  const t = useTheme();
  const object = firstObject(props);
  if (!object) return null;
  const title = String(object.properties.title ?? object.id);
  const preview = String(object.properties.preview ?? object.properties.bodyText ?? '');
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/object/[id]', params: { id: object.id } })}
      style={[styles.card, { backgroundColor: t.c.raised, borderColor: t.c.border }]}
    >
      <AppText variant="headline" numberOfLines={2}>{title}</AppText>
      {preview ? <AppText variant="caption" tone="muted" numberOfLines={3}>{preview}</AppText> : null}
    </Pressable>
  );
}

function ThreadRenderer(props: ViewRenderProps) {
  const object = firstObject(props);
  if (!object) return null;
  return (
    <Pressable onPress={() => router.push({ pathname: '/thread/[id]', params: { id: object.id } })}>
      <AppText variant="headline">{String(object.properties.title ?? 'Thread')}</AppText>
    </Pressable>
  );
}

function MarkdownDocumentRenderer(props: ViewRenderProps) {
  const object = firstObject(props);
  const t = useTheme();
  if (!object) return null;
  return (
    <View style={styles.document}>
      <AppText variant="display2" style={{ fontFamily: t.speakerFonts.human }}>
        {String(object.properties.title ?? object.id)}
      </AppText>
      <AppText variant="body" style={{ fontFamily: t.speakerFonts.human }}>
        {String(object.properties.bodyText ?? '')}
      </AppText>
    </View>
  );
}

function ProposalRenderer(props: ViewRenderProps) {
  const object = firstObject(props);
  if (!object) return null;
  return <ProposalCard proposal={object.properties as unknown as AgencyProposal} canApprove={false} />;
}

/** The native half of the shared descriptor contract. */
export const mobileViewRegistry = createViewRegistry([
  bindViewRenderer(fieldOrganContracts.compactCard, CompactCardRenderer),
  bindViewRenderer(fieldOrganContracts.thread, ThreadRenderer),
  bindViewRenderer(fieldOrganContracts.markdownDocument, MarkdownDocumentRenderer),
  bindViewRenderer(fieldOrganContracts.proposalCard, ProposalRenderer),
]);

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, gap: 6 },
  document: { gap: 14 },
});
