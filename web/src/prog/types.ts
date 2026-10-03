import type { D4 } from "../core/d4.ts";
import type { Vec2 } from "../core/vec2.ts";
import type { ShapeDef } from "../model/shape.ts";
import type { TessellationDef } from "../model/tessellation.ts";

/** A tile placed by the player: an orientation plus an integer offset. */
export interface ProPlacement {
  readonly orientation: D4;
  readonly offset: Vec2;
}

/** One playable shape and the tessellations it must be made to form. */
export interface Level {
  readonly id: string;
  readonly shape: ShapeDef;
  /** Number of cells in the shape (its "size"). */
  readonly size: number;
  /** All canonical tessellations of the shape; the level's targets. */
  readonly targets: readonly TessellationDef[];
}
