import * as chrono from "chrono-node";

import { moment } from "../../utils";

export class Completion {
  public static completeDate(prompt: string): string | null {
    // Use forwardDate: true to prefer future dates (e.g., "sun" means next Sunday, not last)
    const parseResult = chrono.parseDate(prompt, new Date(), { forwardDate: true });
    if (parseResult !== null) {
      return moment(parseResult).format("YYYY-MM-DD");
    }
    return null;
  }
}
