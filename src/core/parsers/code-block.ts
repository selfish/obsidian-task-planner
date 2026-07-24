function expandTabs(line: string): string {
  let columns = 0;
  let expanded = "";
  for (const character of line) {
    const width = character === "\t" ? 4 - (columns % 4) : 1;
    expanded += character === "\t" ? " ".repeat(width) : character;
    columns += width;
  }
  return expanded;
}

export function fencedCodeBlockLines(lines: string[]): Set<number> {
  const fenced = new Set<number>();
  let open: { character: string; length: number; minIndent: number; maxIndent: number } | undefined;
  const listContentIndents: number[] = [];

  lines.forEach((line, index) => {
    const expanded = expandTabs(line);
    const indent = expanded.match(/^ */)?.[0].length ?? 0;
    if (open && expanded.trim() && indent < open.minIndent) open = undefined;
    const thematicBreak = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(expanded);
    const listItem = thematicBreak ? null : /^( *)(?:[-+*]|\d+[.)])(?: {1,4}(?! )| |$)/.exec(expanded);

    if (!open) {
      if (listItem) {
        const markerIndent = listItem[1].length;
        while (listContentIndents.length && markerIndent < listContentIndents[listContentIndents.length - 1]) listContentIndents.pop();
        listContentIndents.push(listItem[0].length + (listItem[0].endsWith(" ") ? 0 : 1));
      } else if (expanded.trim()) {
        while (listContentIndents.length && indent < listContentIndents[listContentIndents.length - 1]) listContentIndents.pop();
      }

      const listContentIndent = listContentIndents[listContentIndents.length - 1];
      const fenceIndent = listItem ? listContentIndent : indent;
      const maxIndent = listItem ? listContentIndent + 3 : listContentIndent !== undefined && indent >= listContentIndent ? listContentIndent + 3 : 3;
      const match = fenceIndent <= maxIndent ? /^(`{3,}|~{3,})(.*)$/.exec(expanded.slice(listItem ? listItem[0].length : indent)) : null;
      if (match && !(match[1][0] === "`" && match[2].includes("`"))) {
        const minIndent = listContentIndent !== undefined && fenceIndent >= listContentIndent ? listContentIndent : 0;
        open = { character: match[1][0], length: match[1].length, minIndent, maxIndent };
        fenced.add(index);
      }
      return;
    }

    fenced.add(index);
    const match = indent >= open.minIndent && indent <= open.maxIndent ? /^(`{3,}|~{3,})(.*)$/.exec(expanded.slice(indent)) : null;
    if (match && match[1][0] === open.character && match[1].length >= open.length && match[2].trim() === "") open = undefined;
  });

  return fenced;
}
