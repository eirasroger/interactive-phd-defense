import { createAnchorField, type AnchorSpec } from '@/components/Anchor';
import { createCaption } from '@/components/Caption';
import { ROOM, SECTION, STATIONS } from '@/config/corridor';
import { ZONE_ORIGIN } from '@/config/layout';
import { act3Captions, STATION_ROLES } from '@/content/act3';
import type { SceneContext, SceneInstance } from '@/engine/scene/types';

const LABEL_HEIGHT = SECTION.floor + 1.4;

/**
 * A label goes in the room's own wing, never on the axis.
 *
 * C1, C2 and C5 stand on the axis and so does the flow, so a label tethered to
 * the station centre lands on top of the one thing in the frame that is moving.
 * Each of those rooms opens to one side — that is what tells the stations apart
 * in the plan — so the label goes into the volume the room already has, and the
 * three come out alternating up and down the run rather than stacked in a line.
 * C3 and C4 are off the axis to begin with and stay where they are.
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
 * Scene 28 — the rise, and the plan it lands on.
 *
 * **One state, one click.** The climb, the ceiling coming off ahead of the
 * camera, the fog opening and the building draining to its own plan are all
 * consequences of this scene's pose, its `travel` and its `air`, so the world
 * is not something the scene sets up. What is left here is the claim and the
 * five stations named, and they arrive with it: naming them, and the pulse the
 * flow is already running, are the same statement — this is the pipeline, and
 * this is what moves through it. Split across beats, each click was adding
 * something the presenter had no separate sentence for.
 *
 * The pulse belongs to the zone, because the flow does: it has been running
 * since C1 and no scene owns it. See `CorridorZone.setProgress`.
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
    // Per frame, not per beat: the climb is still easing out after the
    // composition has arrived.
    context.onFrame(() => field.track());

    field.show(true).delay(context.entryDelay + 0.5);
  }
}
