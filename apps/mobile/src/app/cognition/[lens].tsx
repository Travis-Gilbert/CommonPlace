import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchAgencyProposals } from '@/api/agency';
import { readInstanceSettings } from '@/api/instance';
import { AppText } from '@/components/AppText';
import { ProposalCard } from '@/components/agency/ProposalCard';
import { useTheme } from '@/theme/ThemeProvider';

export default function CognitionLensScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { lens } = useLocalSearchParams<{ lens: string }>();
  const [tenant, setTenant] = useState<string | null>(null);
  const consistency = lens === 'consistency';

  useEffect(() => { readInstanceSettings().then((settings) => setTenant(settings.tenant ?? null)); }, []);
  const proposals = useQuery({
    queryKey: ['agency-proposals', tenant],
    enabled: Boolean(tenant),
    queryFn: () => fetchAgencyProposals(tenant!),
    retry: false,
  });

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <View style={[styles.topbar, { paddingTop: insets.top + 6, borderBottomColor: t.c.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back"><Ionicons name="chevron-back" size={24} color={t.c.text} /></Pressable>
        <AppText variant="headline">{consistency ? 'Consistency' : 'Decision'}</AppText>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <AppText variant="body" tone="muted">
          {consistency ? 'Direct verifier and solver receipts. No agent invocation required.' : 'Prepared decisions with their exact effect and evidence boundary.'}
        </AppText>
        {proposals.isError ? <State title="Lens unavailable" detail="This node does not expose the verified-cognition proposal projection yet." /> : null}
        {proposals.isLoading ? <State title="Reading receipts" detail="Loading the current bounded projection." /> : null}
        {(proposals.data ?? []).length === 0 && !proposals.isLoading && !proposals.isError ? <State title="No verified decisions" detail="The lens stays quiet when no receipt-backed proposal exists." /> : null}
        {(proposals.data ?? []).map((proposal) => consistency ? (
          <Pressable key={proposal.id} onPress={() => router.push({ pathname: '/proposal/[id]', params: { id: proposal.id } })} style={[styles.receipt, { backgroundColor: t.c.surface, borderColor: t.c.border }]}>
            <AppText variant="headline" style={{ color: t.speaker.agent, fontFamily: t.speakerFonts.agent }}>{proposal.whatChanged}</AppText>
            <AppText variant="micro" tone="faint" style={{ fontFamily: t.speakerFonts.machine }}>VERIFIER AND SOLVER RECEIPTS</AppText>
            {proposal.verifierReceiptRefs.length ? proposal.verifierReceiptRefs.map((receipt) => <AppText key={receipt} variant="caption" style={{ color: t.speaker.memory, fontFamily: t.speakerFonts.machine }}>{receipt}</AppText>) : <AppText variant="caption" tone="faint">No verifier receipt recorded.</AppText>}
            {!proposal.assumptionLabelComplete ? <AppText variant="caption" tone="muted">Within the explored frontier; not exhaustive.</AppText> : null}
          </Pressable>
        ) : (
          <Pressable key={proposal.id} onPress={() => router.push({ pathname: '/proposal/[id]', params: { id: proposal.id } })}>
            <ProposalCard proposal={proposal} compact canApprove={false} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  function State({ title, detail }: { title: string; detail: string }) {
    return <View style={[styles.state, { backgroundColor: t.c.raised, borderColor: t.c.border }]}><AppText variant="headline">{title}</AppText><AppText variant="caption" tone="muted">{detail}</AppText></View>;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingBottom: 10 },
  spacer: { width: 24 },
  body: { padding: 16, gap: 12, paddingBottom: 60 },
  receipt: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16, gap: 8 },
  state: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16, gap: 6 },
});
