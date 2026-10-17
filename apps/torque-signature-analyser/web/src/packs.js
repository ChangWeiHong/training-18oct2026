// Pure helpers for the sample-pack chooser and the demo URL flags.

/** Pack list -> [{ joint, label, packs }] in first-seen order. */
export function groupPacks(packs) {
  const groups = [];
  for (const p of packs ?? []) {
    const joint = p.joint ?? 'other';
    let g = groups.find((x) => x.joint === joint);
    if (!g) { g = { joint, label: p.joint_name ?? 'Sample packs', packs: [] }; groups.push(g); }
    g.packs.push(p);
  }
  return groups;
}

/** Upload, reference and template controls stay hidden unless the URL carries ?upload=1. */
export function showUploadControls(search) {
  return new URLSearchParams(search ?? '').get('upload') === '1';
}

/** The wheel-hub mixed shift when present, else the first pack. */
export function defaultPackId(packs) {
  return (packs?.find((p) => p.id === 'mixed') ?? packs?.[0])?.id ?? null;
}

/** Bolts per assembly for the 3D flange. 1 to 6; anything else draws six. */
export function packBolts(pack) {
  const n = pack?.bolts;
  return Number.isInteger(n) && n >= 1 && n <= 6 ? n : 6;
}

/** Visible option text: joint first, so the collapsed picker still says which joint it is. */
export function packOptionLabel(pack) {
  return pack?.joint_name ? `${pack.joint_name} · ${pack.name}` : pack?.name;
}
