import * as chrono from "chrono-node";

import { moment } from "../../utils";

export class Completion {
  public static completeDate(prompt: string): string | null {
    const parseResult = chrono.parseDate(prompt);
    if (parseResult !== null) {
      return moment(parseResult).format("YYYY-MM-DD");
    }
    return null;
  }
}
