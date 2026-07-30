export function fencedCodeBlockLines(lines: string[]): Set<number> {
  const fenced = new Set<number>();
  let fence: { marker: "`" | "~"; length: number } | undefined;

  lines.forEach((line, index) => {
    if (fence) {
      fenced.add(index);
      const closing = /^\s*(`+|~+)\s*$/.exec(line);
      if (closing?.[1][0] === fence.marker && closing[1].length >= fence.length) fence = undefined;
      return;
    }

    const opening = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (!opening || (opening[1][0] === "`" && opening[2].includes("`"))) return;
    fence = { marker: opening[1][0] as "`" | "~", length: opening[1].length };
    fenced.add(index);
  });

  return fenced;
}
