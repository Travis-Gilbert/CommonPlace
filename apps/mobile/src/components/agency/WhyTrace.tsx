import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { AgencyProposal } from '@/agency/types';
import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';

export function WhyTrace({
  proposal,
  initiallyOpen = false,
  onOpenEvidence,
}: {
  proposal: AgencyProposal;
  initiallyOpen?: boolean;
  onOpenEvidence?: (reference: string) => void;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(initiallyOpen);
  const groups = [
    ['Supporting evidence', proposal.evidenceRefs],
    ['Disagreeing evidence', proposal.counterEvidenceRefs],
    ['Verifier and solver receipts', proposal.verifierReceiptRefs],
  ] as const;

  return (
    <View style={[styles.root, { borderTopColor: t.c.border }]} accessibilityLabel={`Why ${proposal.id} is proposed`}>
      <Pressable onPress={() => setOpen((current) => !current)} style={styles.toggle} accessibilityState={{ expanded: open }}>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={t.speaker.agent} />
        <AppText variant="caption" style={{ color: t.speaker.agent, fontFamily: t.speakerFonts.agent }}>
          {open ? 'Hide why' : 'Show why'}
        </AppText>
      </Pressable>
      {open ? (
        <View style={styles.body}>
          {groups.map(([label, references]) => (
            <View key={label} style={styles.group}>
              <AppText variant="micro" tone="faint" style={{ fontFamily: t.speakerFonts.machine }}>
                {label}
              </AppText>
              {references.length ? (
                <View style={styles.chips}>
                  {references.map((reference) => (
                    <Pressable
                      key={reference}
                      onPress={() => onOpenEvidence?.(reference)}
                      style={[styles.chip, { borderColor: t.c.border, backgroundColor: t.c.muted }]}
                    >
                      <AppText variant="micro" style={{ color: t.speaker.agent, fontFamily: t.speakerFonts.machine }}>
                        {reference}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <AppText variant="caption" tone="faint">None recorded.</AppText>
              )}
            </View>
          ))}
          <View style={styles.group}>
            <AppText variant="micro" tone="faint" style={{ fontFamily: t.speakerFonts.machine }}>Assumptions</AppText>
            {proposal.assumptionEnvironments.length ? proposal.assumptionEnvironments.map((environment, index) => (
              <AppText key={`${proposal.id}:assumption:${index}`} variant="caption">
                {environment.join(' and ')}
              </AppText>
            )) : <AppText variant="caption" tone="faint">No assumption environment was retained.</AppText>}
          </View>
          {!proposal.assumptionLabelComplete ? (
            <AppText variant="caption" style={{ color: t.speaker.memory }}>
              Within the explored frontier. This label is bounded, not exhaustive.
            </AppText>
          ) : null}
          <AppText variant="caption" tone="muted">
            Acceptance binds the exact effect contract and fresh preconditions, not this explanation alone.
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  toggle: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6 },
  body: { gap: 14, paddingBottom: 4 },
  group: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
});
