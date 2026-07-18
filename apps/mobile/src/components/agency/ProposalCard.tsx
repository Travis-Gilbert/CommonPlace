import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { AgencyAction, AgencyProposal } from '@/agency/types';
import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';

import { WhyTrace } from './WhyTrace';

const MINIMUM_REVIEW_MS = 1200;

export function ProposalCard({
  proposal,
  compact = false,
  canApprove,
  pending,
  onAction,
  onOpenEvidence,
}: {
  proposal: AgencyProposal;
  compact?: boolean;
  canApprove: boolean;
  pending?: AgencyAction | null;
  onAction?: (action: AgencyAction) => void;
  onOpenEvidence?: (reference: string) => void;
}) {
  const t = useTheme();
  const [reviewedLongEnough, setReviewedLongEnough] = useState(false);
  const expired = proposal.expiresAtMs <= Date.now();

  useEffect(() => {
    setReviewedLongEnough(false);
    const timer = setTimeout(() => setReviewedLongEnough(true), MINIMUM_REVIEW_MS);
    return () => clearTimeout(timer);
  }, [proposal.id, proposal.payloadHash, proposal.preconditionHash]);

  const approvalEnabled = canApprove && reviewedLongEnough && !expired && !pending;
  const visibleArtifact = proposal.reversibility === 'visible_artifact';

  return (
    <View style={[styles.card, { backgroundColor: t.c.surface, borderColor: t.c.border, borderLeftColor: t.c.primary }]}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <AppText variant="micro" style={{ color: t.speaker.agent, fontFamily: t.speakerFonts.machine }}>PROPOSAL</AppText>
          <AppText variant={compact ? 'headline' : 'display2'} style={{ fontFamily: t.speakerFonts.agent, color: t.speaker.agent }}>
            {proposal.whatChanged}
          </AppText>
        </View>
        <View style={[styles.permission, { backgroundColor: t.c.primaryWash }]}>
          <AppText variant="micro" style={{ color: t.c.primary, fontFamily: t.speakerFonts.machine }}>
            {proposal.permission.replaceAll('_', ' ')}
          </AppText>
        </View>
      </View>

      <View style={styles.summary}>
        <Summary label="Why it matters" value={proposal.goalRefs.join(', ') || 'No goal reference supplied.'} />
        <Summary label="Affected" value={proposal.stakeRefs.join(', ') || 'No stake reference supplied.'} />
        <Summary label="Prepared" value={proposal.previewRef} />
        <Summary label="Next" value={`${proposal.actionClass} via ${proposal.executorId}`} />
        {!compact ? <Summary label="Effect contract" value={proposal.effectContractHash} mono /> : null}
        <Summary label="Reversibility" value={proposal.reversibility.replaceAll('_', ' ')} />
        <Summary label="Expires" value={new Date(proposal.expiresAtMs).toLocaleString()} />
      </View>

      {visibleArtifact ? proposal.disclosures.map((disclosure) => (
        <View key={disclosure.id} style={[styles.disclosure, { borderLeftColor: t.speaker.memory }]}>
          <AppText variant="caption" style={{ color: t.speaker.memory }}>{disclosure.text}</AppText>
        </View>
      )) : null}

      <WhyTrace proposal={proposal} onOpenEvidence={onOpenEvidence} />

      {onAction ? (
        <View style={styles.actions} accessibilityLabel="Proposal controls">
          {canApprove ? (
            <Pressable
              disabled={!approvalEnabled}
              onPress={() => onAction('approve')}
              style={[styles.action, styles.primaryAction, { backgroundColor: t.c.primary, opacity: approvalEnabled ? 1 : 0.45 }]}
            >
              <Ionicons name="checkmark" size={16} color={t.c.onPrimary} />
              <AppText variant="caption" tone="onPrimary">{pending === 'approve' ? 'Preflighting...' : expired ? 'Expired' : reviewedLongEnough ? 'Approve once' : 'Reviewing...'}</AppText>
            </Pressable>
          ) : null}
          <Action label="Edit" onPress={() => onAction('edit')} disabled={Boolean(pending)} />
          <Action label="Dismiss" onPress={() => onAction('dismiss')} disabled={Boolean(pending)} />
          <Action label="Suppress" onPress={() => onAction('suppress')} disabled={Boolean(pending)} />
          <Action label="Always for this pattern" onPress={() => onAction('grant')} disabled={Boolean(pending)} />
        </View>
      ) : null}

      {!canApprove && onAction ? (
        <AppText variant="caption" tone="muted">
          Approval appears only with a live kernel connection and a configured signature reference. Offline approval does not exist.
        </AppText>
      ) : null}
    </View>
  );

  function Summary({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
      <View style={styles.summaryItem}>
        <AppText variant="micro" tone="faint" style={{ fontFamily: t.speakerFonts.machine }}>{label}</AppText>
        <AppText variant="caption" style={mono ? { fontFamily: t.speakerFonts.machine } : undefined}>{value}</AppText>
      </View>
    );
  }

  function Action({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
    return (
      <Pressable disabled={disabled} onPress={onPress} style={[styles.action, { borderColor: t.c.border, opacity: disabled ? 0.45 : 1 }]}>
        <AppText variant="caption">{label}</AppText>
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 3, borderRadius: 14, padding: 16, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  titleBlock: { flex: 1, gap: 4 },
  permission: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 5, maxWidth: 130 },
  summary: { gap: 10 },
  summaryItem: { gap: 2 },
  disclosure: { borderLeftWidth: 2, paddingLeft: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { minHeight: 36, borderWidth: StyleSheet.hairlineWidth, borderRadius: 9, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  primaryAction: { borderWidth: 0 },
});
