export type AnimeheavenEpisodeListEntry = {
  episodeNumber: number;
  hash: string;
};

// Each episode entry on the series page looks like:
//   <a class='c' onmouseover='gateh("HASH")' onclick='gatea("HASH")'  id ="HASH" href= 'gate.php'
//   ><div class='trackep0 watch bc2'>...<div class='watch1 bc c'>Episode</div>
//   <div  class= ' watch2 bc ' >NUMBER</div>...
// The hash is AnimeHeaven's per-episode "gate key" (see AnimeheavenVideoService)
// — not a URL, so it's cached as-is rather than resolved up front.
export function parseAnimeheavenEpisodeList(html: string): AnimeheavenEpisodeListEntry[] {
  const entries: AnimeheavenEpisodeListEntry[] = [];
  const re = /gatea\("([0-9a-f]+)"\)[\s\S]*?watch2 bc ' >(\d+)</g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    entries.push({ hash: match[1], episodeNumber: Number(match[2]) });
  }
  // The site lists newest-first; normalize to ascending so callers (and any
  // UI iterating this list) see episode 1 first.
  return entries.sort((a, b) => a.episodeNumber - b.episodeNumber);
}
