// Re-export moment with proper typing (Obsidian's type exports the namespace, not the callable function)
import { moment as obsidianMoment } from "obsidian";

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
  day(): number;
  isoWeekday(): number;
}

type MomentInput = string | number | Date | Moment | null | undefined;

type MomentFunction = {
  (): Moment;
  (inp?: MomentInput, strict?: boolean): Moment;
  (inp?: MomentInput, format?: string | string[], strict?: boolean): Moment;
  (inp?: MomentInput, format?: string | string[], language?: string, strict?: boolean): Moment;
};

export const moment = obsidianMoment as unknown as MomentFunction;
export type { Moment };
