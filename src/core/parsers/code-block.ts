function columnWidth(value: string): number {
  let columns = 0;
  for (const character of value) columns += character === "\t" ? 4 - (columns % 4) : 1;
  return columns;
}

function expandIndent(line: string): string {
  const indent = line.match(/^[ \t]*/)?.[0] ?? "";
  return " ".repeat(columnWidth(indent)) + line.slice(indent.length);
}

export function fencedCodeBlockLines(lines: string[]): Set<number> {
  const fenced = new Set<number>();
  let open: { character: string; length: number; maxIndent: number } | undefined;
  let listContentIndent: number | undefined;

  lines.forEach((line, index) => {
    const expanded = expandIndent(line);
    const indent = expanded.match(/^ */)?.[0].length ?? 0;
    const thematicBreak = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(expanded);
    const listItem = thematicBreak ? null : /^( *)(?:[-+*]|\d+[.)])(?:[ \t]+|$)/.exec(expanded);

    if (!open) {
      if (listItem) listContentIndent = columnWidth(listItem[0]) + (/[ \t]$/.test(listItem[0]) ? 0 : 1);
      else if (expanded.trim() && listContentIndent !== undefined && indent < listContentIndent) listContentIndent = undefined;

      const fenceIndent = listItem ? listContentIndent : indent;
      const maxIndent = listItem ? listContentIndent + 3 : listContentIndent !== undefined && indent >= listContentIndent ? listContentIndent + 3 : 3;
      const match = fenceIndent <= maxIndent ? /^(`{3,}|~{3,})(.*)$/.exec(expanded.slice(listItem ? listItem[0].length : indent)) : null;
      if (match && !(match[1][0] === "`" && match[2].includes("`"))) {
        open = { character: match[1][0], length: match[1].length, maxIndent };
        fenced.add(index);
      }
      return;
    }

    fenced.add(index);
    const match = indent <= open.maxIndent ? /^(`{3,}|~{3,})(.*)$/.exec(expanded.slice(indent)) : null;
    if (match && match[1][0] === open.character && match[1].length >= open.length && match[2].trim() === "") open = undefined;
  });

  return fenced;
}
