/**
 * Re-export moment with proper typing.
 *
 * Obsidian provides moment globally, but the type definition exports it as
 * `typeof Moment` (the namespace) rather than the callable function.
 * This wrapper provides proper types for the moment function.
 */
import { moment as obsidianMoment } from "obsidian";
import type { Moment, MomentInput } from "moment";

// Cast to the correct callable type
type MomentFunction = {
  (): Moment;
  (inp?: MomentInput, strict?: boolean): Moment;
  (inp?: MomentInput, format?: string | string[], strict?: boolean): Moment;
  (inp?: MomentInput, format?: string | string[], language?: string, strict?: boolean): Moment;
};

export const moment = obsidianMoment as unknown as MomentFunction;
export type { Moment };
