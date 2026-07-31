import { describe, expect, it } from 'vitest';
import type { ProgramBindingPreset } from '@commonplace/program-contracts';
import { visiblePresetRoster } from './BindingStationTray';
import { stationBadgeFor } from './programNodeKind';

const transparent: ProgramBindingPreset = {
  preset_id: 'preset:principal',
  display_name: 'Personal pair',
  binding_ref: 'composition:principal',
  topology: 'pair',
  capability_pack: ['theorem.peer-stations.v1'],
  budget_units: 200,
  sealed: false,
  owner_principal_id: 'principal:owner',
  roster: [{
    head_id: 'head:one',
    provider: 'byok',
    model: 'owned-model',
    role: 'executor',
  }],
};

describe('binding station disclosure', () => {
  it('hides a sealed system roster even if a malformed response includes one', () => {
    expect(visiblePresetRoster({
      ...transparent,
      preset_id: 'preset:system',
      sealed: true,
      owner_principal_id: undefined,
    })).toEqual([]);
  });

  it('shows a transparent principal-owned roster from the same query shape', () => {
    expect(visiblePresetRoster(transparent)).toEqual(transparent.roster);
  });

  it('renders the server-compiled topology as the node station badge', () => {
    expect(stationBadgeFor({
      preset_id: 'preset:principal',
      binding_ref: 'composition:principal',
      capability_pack: ['theorem.peer-stations.v1'],
      budget_units: 200,
      topology: 'peer',
      compiled_topology: 'pair',
      sealed: false,
    })).toMatchObject({
      id: 'station',
      text: 'pair station',
    });
  });
});
