/**
 * Re-export moment with proper typing.
 *
 * Obsidian provides moment globally, but the type definition exports it as
 * `typeof Moment` (the namespace) rather than the callable function.
 * This wrapper provides proper types for the moment function.
 */
import { moment as obsidianMoment } from "obsidian";

// Define Moment interface based on moment.js API used in this plugin
interface Moment {
  format(formatStr?: string): string;
  isValid(): boolean;
  isBefore(other: Moment | string | Date): boolean;
  isAfter(other: Moment | string | Date): boolean;
  isSameOrAfter(other: Moment | string | Date): boolean;
  isSameOrBefore(other: Moment | string | Date): boolean;
  isSame(other: Moment | string | Date, granularity?: string): boolean;
  clone(): Moment;
  add(amount: number, unit: string): Moment;
  subtract(amount: number, unit: string): Moment;
  startOf(unit: string): Moment;
  endOf(unit: string): Moment;
  diff(other: Moment | string | Date, unit?: string): number;
  year(): number;
  month(): number;
  date(): number;
  isoWeekday(): number;
}

// MomentInput type inline to avoid importing from 'moment' package
type MomentInput = string | number | Date | Moment | null | undefined;

// Cast to the correct callable type
type MomentFunction = {
  (): Moment;
  (inp?: MomentInput, strict?: boolean): Moment;
  (inp?: MomentInput, format?: string | string[], strict?: boolean): Moment;
  (inp?: MomentInput, format?: string | string[], language?: string, strict?: boolean): Moment;
};

export const moment = obsidianMoment as unknown as MomentFunction;
export type { Moment };
