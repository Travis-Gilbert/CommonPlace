import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AgencyAction } from '@/agency/types';
import {
  approveAgencyProposal,
  dismissAgencyProposal,
  fetchAgencyEvidence,
  fetchAgencyProposal,
  suppressAgencyProposal,
} from '@/api/agency';
import { probeInstance, readInstanceSettings, type InstanceSettings } from '@/api/instance';
import { AppText } from '@/components/AppText';
import { ProposalCard } from '@/components/agency/ProposalCard';
import { rememberDismissedBasis } from '@/notifications';
import { recordAttentionSignal } from '@/signals/attention';
import { useTheme } from '@/theme/ThemeProvider';

export default function ProposalScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { id, grant } = useLocalSearchParams<{ id: string; grant?: string }>();
  const proposalId = id!;
  const [settings, setSettings] = useState<InstanceSettings | null>(null);
  const [pending, setPending] = useState<AgencyAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    readInstanceSettings().then(async (next) => {
      setSettings(next);
      const result = await probeInstance(next.url, next.apiKey);
      setLive(result.ok);
    });
  }, []);

  const proposal = useQuery({
    queryKey: ['agency-proposal', settings?.tenant, proposalId],
    enabled: Boolean(settings?.tenant),
    queryFn: () => fetchAgencyProposal(settings!.tenant!, proposalId),
    retry: 1,
  });

  useEffect(() => {
    const current = proposal.data;
    if (current) {
      recordAttentionSignal({ subjectId: current.id, basisHash: current.basisHash, kind: 'opened' });
    }
  }, [proposal.data]);

  async function act(action: AgencyAction) {
    if (!settings?.tenant || !proposal.data || pending) return;
    if (action === 'grant') {
      router.setParams({ grant: '1' });
      return;
    }
    if (action === 'edit') {
      setMessage('Editing creates a replacement proposal and requires a new exact approval. The kernel has not exposed that mutation yet.');
      return;
    }
    setPending(action);
    setMessage(null);
    try {
      if (action === 'approve') {
        if (!settings.userSignatureRef) throw new Error('Configure an approval signature reference in Account first.');
        const receipt = await approveAgencyProposal({
          tenantId: settings.tenant,
          proposalId: proposal.data.id,
          userSignatureRef: settings.userSignatureRef,
          expiresAtMs: Math.min(proposal.data.expiresAtMs, Date.now() + 30 * 60_000),
        });
        setMessage(`Exact approval recorded: ${receipt.approvalReceiptId}. Fresh preflight passed; execution remains receipt-bound.`);
      } else if (action === 'dismiss') {
        await dismissAgencyProposal({ tenantId: settings.tenant, proposalId: proposal.data.id, reason: 'Dismissed on mobile' });
        recordAttentionSignal({ subjectId: proposal.data.id, basisHash: proposal.data.basisHash, kind: 'dismissed' });
        await rememberDismissedBasis(proposal.data.basisHash);
        setMessage('Dismissed. It can return only when its material basis changes.');
      } else if (action === 'suppress') {
        await suppressAgencyProposal({ tenantId: settings.tenant, proposalId: proposal.data.id, reason: 'Suppressed on mobile' });
        recordAttentionSignal({ subjectId: proposal.data.id, basisHash: proposal.data.basisHash, kind: 'do_not_show_again' });
        await rememberDismissedBasis(proposal.data.basisHash);
        setMessage('Suppressed for this basis.');
      }
      await queryClient.invalidateQueries({ queryKey: ['agency-proposals'] });
      await proposal.refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setPending(null);
    }
  }

  async function openEvidence(reference: string) {
    if (!settings?.tenant || !proposal.data) return;
    try {
      const evidence = await fetchAgencyEvidence({ tenantId: settings.tenant, proposalId: proposal.data.id, reference });
      Alert.alert(reference, evidence.archiveBody ?? evidence.archiveContentHash ?? 'The source reference is retained, but no archive body is available.');
    } catch (error) {
      Alert.alert('Evidence unavailable', error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <View style={[styles.topbar, { paddingTop: insets.top + 6, borderBottomColor: t.c.border }]}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back" hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={t.c.text} />
        </Pressable>
        <AppText variant="headline">{grant === '1' ? 'Grant review' : 'Proposal review'}</AppText>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {proposal.isLoading || !settings ? <AppText variant="sub" tone="muted">Loading the current proposal...</AppText> : null}
        {proposal.isError ? (
          <View style={[styles.state, { backgroundColor: t.c.raised, borderColor: t.c.border }]}>
            <AppText variant="headline">Agency kernel unavailable</AppText>
            <AppText variant="caption" tone="muted">{proposal.error instanceof Error ? proposal.error.message : String(proposal.error)}</AppText>
          </View>
        ) : null}
        {proposal.data ? (
          <>
            {grant === '1' ? (
              <View style={[styles.state, { backgroundColor: t.c.raised, borderColor: t.c.border }]}>
                <AppText variant="display2">Always for this pattern</AppText>
                <AppText variant="body">
                  A standing grant broadens capability. Review the full effect contract and pattern below. Signing is unavailable until the kernel exposes a grant-proposal executor.
                </AppText>
                <AppText variant="caption" tone="muted">Effect contract: {proposal.data.effectContractHash}</AppText>
                <AppText variant="caption" tone="muted">Action pattern: {proposal.data.actionClass}</AppText>
                <AppText variant="caption" tone="muted">Target: {proposal.data.targetIdentity}</AppText>
              </View>
            ) : null}
            <ProposalCard
              proposal={proposal.data}
              canApprove={live && Boolean(settings?.userSignatureRef) && !proposal.isError && grant !== '1'}
              pending={pending}
              onAction={(action) => void act(action)}
              onOpenEvidence={(reference) => void openEvidence(reference)}
            />
          </>
        ) : null}
        {message ? <View style={[styles.message, { backgroundColor: t.c.primaryWash }]}><AppText variant="caption" style={{ color: t.c.primary }}>{message}</AppText></View> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingBottom: 10 },
  spacer: { width: 24 },
  body: { padding: 16, gap: 14, paddingBottom: 60 },
  state: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16, gap: 10 },
  message: { borderRadius: 10, padding: 12 },
});
