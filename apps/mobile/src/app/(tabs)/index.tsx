import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchAgencyProposals } from '@/api/agency';
import { listRooms } from '@/api/harness';
import { readInstanceSettings, type InstanceSettings } from '@/api/instance';
import { fetchBriefing, fetchOrganize } from '@/api/queries';
import { AppText } from '@/components/AppText';
import { ProposalCard } from '@/components/agency/ProposalCard';
import { useOmnibar } from '@/components/omnibar/OmnibarContext';
import { useTheme } from '@/theme/ThemeProvider';

export default function HomeScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { open: openCapture } = useOmnibar();
  const [settings, setSettings] = useState<InstanceSettings | null>(null);

  useEffect(() => {
    readInstanceSettings().then(setSettings);
  }, []);

  const briefing = useQuery({ queryKey: ['briefing'], queryFn: fetchBriefing, retry: 1 });
  const organize = useQuery({ queryKey: ['organize'], queryFn: () => fetchOrganize('day'), retry: 1 });
  const rooms = useQuery({ queryKey: ['rooms'], queryFn: listRooms, retry: 1, enabled: Boolean(settings?.harnessUrl), refetchInterval: 30_000 });
  const proposals = useQuery({
    queryKey: ['agency-proposals', settings?.tenant],
    queryFn: () => fetchAgencyProposals(settings!.tenant!, 20),
    enabled: Boolean(settings?.tenant),
    retry: false,
  });

  const recent = briefing.data?.recent ?? [];
  const prepared = proposals.data ?? [];
  const relief = [
    { label: 'caught', value: organize.data?.organizedToday.totalCount ?? 0 },
    { label: 'closed', value: organize.data?.dailyProgress.done ?? 0 },
    { label: 'connected', value: briefing.data?.newlyConnected.length ?? 0 },
  ];

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 8, paddingBottom: t.layout.tabPillHeight + 56 }]}>
        <View style={styles.header}>
          <View>
            <AppText variant="micro" tone="faint" style={{ fontFamily: t.speakerFonts.machine }}>FIELD ORGAN</AppText>
            <AppText variant="display1">Home</AppText>
          </View>
          <Pressable onPress={() => router.push('/account')} accessibilityLabel="Account" style={[styles.iconButton, { backgroundColor: t.c.secondary }]}>
            <Ionicons name="person-outline" size={18} color={t.c.textMuted} />
          </Pressable>
        </View>

        <Pressable
          onPress={() => openCapture()}
          style={styles.capturePressable}
          android_ripple={{ color: t.c.primaryPressed }}
        >
          <View style={[styles.capture, { backgroundColor: t.c.primary }]}>
            <View style={styles.captureCopy}>
              <AppText variant="headline" tone="onPrimary">Capture what you encountered</AppText>
              <AppText variant="caption" tone="onPrimary">Writes to this phone first, then files with provenance.</AppText>
            </View>
            <Ionicons name="add-circle-outline" size={30} color={t.c.onPrimary} />
          </View>
        </Pressable>

        <View style={styles.lensRow}>
          <Lens label="Decision" icon="git-compare-outline" onPress={() => router.push('/cognition/decision')} />
          <Lens label="Consistency" icon="shield-checkmark-outline" onPress={() => router.push('/cognition/consistency')} />
        </View>

        <Section title="Prepared for your decision" subtitle="Approvals are the hero. Chat remains available, but it is not the job hierarchy.">
          {prepared.length ? prepared.slice(0, 5).map((proposal) => (
            <Pressable key={proposal.id} onPress={() => router.push({ pathname: '/proposal/[id]', params: { id: proposal.id } })}>
              <ProposalCard proposal={proposal} compact canApprove={false} />
            </Pressable>
          )) : (
            <EmptyState
              title={proposals.isError ? 'Agency proposals unavailable' : proposals.isLoading ? 'Checking prepared work' : 'Nothing needs your attention'}
              detail={proposals.isError ? 'The live kernel projection is not available on this node. No approval affordance is shown.' : 'No grounded proposal is waiting. This silence is intentional.'}
            />
          )}
        </Section>

        <Section title="Relief ledger" subtitle="Evidence that the harness worked in your favor.">
          <View style={styles.reliefRow}>
            {relief.map((item) => (
              <View key={item.label} style={[styles.relief, { backgroundColor: t.c.raised, borderColor: t.c.border }]}>
                <AppText variant="display2" style={{ color: item.value ? t.speaker.memory : t.c.textFaint }}>{item.value}</AppText>
                <AppText variant="micro" tone="faint" style={{ fontFamily: t.speakerFonts.machine }}>{item.label}</AppText>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Running work" subtitle="Quiet presence, not a dashboard.">
          {(rooms.data ?? []).length ? (rooms.data ?? []).slice(0, 5).map((room) => (
            <Pressable
              key={room.room_id}
              onPress={() => router.push({ pathname: '/room/[id]', params: { id: room.room_id } })}
              style={[styles.row, { backgroundColor: t.c.surface, borderBottomColor: t.c.border }]}
            >
              <View style={[styles.presence, { backgroundColor: t.speaker.agent }]} />
              <View style={styles.rowCopy}>
                <AppText variant="sub" numberOfLines={1}>{room.room_id}</AppText>
                {room.latest_message ? <AppText variant="caption" tone="muted" numberOfLines={1}>{room.latest_message}</AppText> : null}
              </View>
              <AppText variant="micro" tone="faint">{room.member_count ?? 0} active</AppText>
            </Pressable>
          )) : <EmptyState title={settings?.harnessUrl ? 'No work is running' : 'Rooms are not configured'} detail="Add a Harness node in Account to supervise delegated work here." />}
        </Section>

        <Section title="Ready to read" subtitle="Briefs and memory documents open at reading density.">
          {recent.length ? recent.slice(0, 4).map((item) => (
            <Pressable key={item.id} onPress={() => router.push({ pathname: '/reader/[id]', params: { id: item.id } })} style={styles.readRow}>
              <Ionicons name="document-text-outline" size={18} color={t.speaker.memory} />
              <View style={styles.rowCopy}>
                <AppText variant="sub" numberOfLines={1}>{item.title}</AppText>
                <AppText variant="caption" tone="muted" numberOfLines={1}>{item.bodyText ?? item.kind}</AppText>
              </View>
              <Ionicons name="chevron-forward" size={16} color={t.c.textFaint} />
            </Pressable>
          )) : <EmptyState title="No brief today" detail="Home invents nothing when the node has no prepared reading." />}
        </Section>
      </ScrollView>
    </View>
  );

  function Lens({ label, icon, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
    return (
      <Pressable onPress={onPress} style={[styles.lens, { backgroundColor: t.c.surface, borderColor: t.c.border }]}>
        <Ionicons name={icon} size={19} color={t.speaker.agent} />
        <AppText variant="caption" style={{ fontFamily: t.speakerFonts.agent, color: t.speaker.agent }}>{label}</AppText>
      </Pressable>
    );
  }

  function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
    return <View style={styles.section}><AppText variant="display2">{title}</AppText><AppText variant="caption" tone="muted">{subtitle}</AppText><View style={styles.sectionBody}>{children}</View></View>;
  }

  function EmptyState({ title, detail }: { title: string; detail: string }) {
    return <View style={[styles.empty, { backgroundColor: t.c.raised, borderColor: t.c.border }]}><AppText variant="headline">{title}</AppText><AppText variant="caption" tone="muted">{detail}</AppText></View>;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 16, gap: 22 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  capturePressable: { borderRadius: 16, overflow: 'hidden' },
  capture: { minHeight: 92, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  captureCopy: { flex: 1, gap: 4 },
  lensRow: { flexDirection: 'row', gap: 10 },
  lens: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  section: { gap: 5 },
  sectionBody: { gap: 10, marginTop: 6 },
  reliefRow: { flexDirection: 'row', gap: 8 },
  relief: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, gap: 2 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowCopy: { flex: 1, gap: 2 },
  presence: { width: 7, height: 7, borderRadius: 4 },
  readRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  empty: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 16, gap: 6 },
});
