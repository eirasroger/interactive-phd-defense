import { createAnchorField, type AnchorSpec } from '@/components/Anchor';
import { createCaption } from '@/components/Caption';
import { ROOM, SECTION, STATIONS } from '@/config/corridor';
import { ZONE_ORIGIN } from '@/config/layout';
import { act3Captions, STATION_ROLES } from '@/content/act3';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';

const LABEL_HEIGHT = SECTION.floor + 1.4;

/**
 * Label x position. Stations on the axis (C1, C2, C5) push their label into
 * the room's wing so it stays clear of the flow. C3 and C4 are already off-axis.
 */
const aside = (station: (typeof STATIONS)[number]): number =>
  station.x === 0
    ? (station.wing === 0 ? -1 : station.wing) * (ROOM.width / 2 + 1.6)
    : station.x;

const anchors: readonly AnchorSpec[] = STATIONS.map((station) => ({
  position: [
    aside(station) + ZONE_ORIGIN.corridor[0],
    LABEL_HEIGHT + ZONE_ORIGIN.corridor[1],
    -station.z + ZONE_ORIGIN.corridor[2],
  ],
  label: `${station.key} · ${STATION_ROLES[station.key] ?? ''}`,
}));

/**
 * Scene 28: the camera rises to the plan view. Single beat. The world changes
 * come from the scene's pose, `travel` and `air`; this class adds the caption
 * and station labels. The flow pulse lives in `CorridorZone.setProgress`.
 */
export class RiseScene implements SceneInstance {
  enter(context: SceneContext): void {
    context.root.dataset['align'] = 'plan';

    const caption = createCaption(act3Captions.whole);
    context.root.appendChild(caption.element);
    caption.reveal(context.entryDelay + 0.15);

    const field = createAnchorField(context.camera, anchors);
    context.root.appendChild(field.element);
    field.show(false, true);
    // Track every frame: the camera is still moving after the labels appear.
    context.onFrame(() => field.track());

    field.show(true).delay(context.entryDelay + 0.5);
  }
}
