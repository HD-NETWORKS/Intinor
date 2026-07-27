/** Short human label for a source URI, shared by canvas + layer list. */
export function sourceLabel(source: string | undefined): string {
  if (!source) return "(none)";
  const ni = source.match(/network_inputs\/(\d+)/);
  if (ni) return `Input ${Number(ni[1]) + 1}`;
  const vi = source.match(/video_inputs\/(\d+)/);
  if (vi) return `Video ${Number(vi[1]) + 1}`;
  const vm = source.match(/video_mixers\/(\d+)/);
  if (vm) return `Mixer ${Number(vm[1]) + 1}`;
  if (/test_picture/.test(source)) return "Test picture";
  return source.split("/").filter(Boolean).pop() ?? source;
}
