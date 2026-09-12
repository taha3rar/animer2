// AniZone embeds JSON payloads as `JSON.parse('...')` inside Alpine x-data
// HTML attributes. The JSON itself (PHP's json_encode, which escapes `/` as
// `\/` by default) then gets escaped a SECOND time so it can live inside a JS
// single-quoted string literal — every backslash in the JSON doubles up.
// Decoding needs exactly one pass of "undo JS string literal escaping": that
// collapses `\\` -> `\` and turns `"` -> `"`, and passes a lone `\/`
// through unchanged (still valid JSON, `JSON.parse` resolves it to `/` itself).
// A regex.replace never rescans its own output, so a single pass is correct
// even for doubled sequences like `\\\/` (JSON's `\/` re-escaped once more).
export function decodeJsStringLiteral(raw: string): string {
  return raw.replace(/\\(u[0-9a-fA-F]{4}|n|r|t|\\|'|"|\/)/g, (_match, esc: string) => {
    if (esc[0] === "u") return String.fromCharCode(parseInt(esc.slice(1), 16));
    if (esc === "n") return "\n";
    if (esc === "r") return "\r";
    if (esc === "t") return "\t";
    return esc; // \\ -> \, \' -> ', \" -> ", \/ -> / (all single-char passthroughs)
  });
}
