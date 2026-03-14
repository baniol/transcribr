import type { Segment } from "../types";

export interface SegmentChange {
  id: number;
  text: string;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function computeSegmentChanges(segments: Segment[], newPlainText: string): SegmentChange[] {
  // Only work with non-empty segments
  const activeSegments = segments.filter((s) => s.text.trim().length > 0);
  if (activeSegments.length === 0) {
    return [];
  }

  const activeTexts = activeSegments.map((s) => s.text);
  const oldPlainText = activeTexts.join(" ");

  if (oldPlainText === newPlainText) {
    return [];
  }

  // Find common prefix length
  let prefixLen = 0;
  const minLen = Math.min(oldPlainText.length, newPlainText.length);
  while (prefixLen < minLen && oldPlainText[prefixLen] === newPlainText[prefixLen]) {
    prefixLen++;
  }

  // Find common suffix length (not overlapping with prefix)
  let suffixLen = 0;
  const maxSuffix = Math.min(oldPlainText.length - prefixLen, newPlainText.length - prefixLen);
  while (
    suffixLen < maxSuffix &&
    oldPlainText[oldPlainText.length - 1 - suffixLen] ===
      newPlainText[newPlainText.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const oldChangeStart = prefixLen;
  const oldChangeEnd = oldPlainText.length - suffixLen;
  const newChangeText = newPlainText.slice(prefixLen, newPlainText.length - suffixLen);

  // Build offset map for active segments
  const segmentOffsets: { start: number; end: number; segIndex: number }[] = [];
  let offset = 0;
  for (let i = 0; i < activeTexts.length; i++) {
    const start = offset;
    const end = offset + activeTexts[i].length;
    segmentOffsets.push({ start, end, segIndex: i });
    offset = end + 1; // +1 for the space separator
  }

  // Find affected segments
  const affected: number[] = [];
  for (const seg of segmentOffsets) {
    if (seg.start < oldChangeEnd && seg.end > oldChangeStart) {
      affected.push(seg.segIndex);
    }
  }

  if (affected.length === 0) {
    for (let i = 0; i < segmentOffsets.length; i++) {
      if (segmentOffsets[i].start >= oldChangeStart) {
        affected.push(i);
        break;
      }
    }
    if (affected.length === 0) {
      affected.push(segmentOffsets.length - 1);
    }
  }

  const changes: SegmentChange[] = [];

  if (affected.length === 1) {
    const idx = affected[0];
    const seg = segmentOffsets[idx];
    const localStart = Math.max(0, oldChangeStart - seg.start);
    const localEnd = Math.min(activeTexts[idx].length, oldChangeEnd - seg.start);
    const newText =
      activeTexts[idx].slice(0, localStart) + newChangeText + activeTexts[idx].slice(localEnd);
    changes.push({ id: activeSegments[idx].id, text: newText });
  } else {
    // Multiple segments affected: merge into first, clear the rest
    const firstIdx = affected[0];
    const lastIdx = affected[affected.length - 1];
    const firstSeg = segmentOffsets[firstIdx];
    const lastSeg = segmentOffsets[lastIdx];

    const keepBefore = activeTexts[firstIdx].slice(0, Math.max(0, oldChangeStart - firstSeg.start));
    const keepAfter = activeTexts[lastIdx].slice(
      Math.min(activeTexts[lastIdx].length, oldChangeEnd - lastSeg.start)
    );
    const mergedText = keepBefore + newChangeText + keepAfter;
    changes.push({ id: activeSegments[firstIdx].id, text: mergedText });

    for (let i = 1; i < affected.length; i++) {
      changes.push({ id: activeSegments[affected[i]].id, text: "" });
    }
  }

  return changes;
}

/**
 * Build a map from each plain-text character index to its HTML source range.
 * Returns an array where map[plainIdx] = { htmlStart, htmlEnd } for that character.
 */
function buildPlainToHtmlMap(html: string): { start: number; end: number }[] {
  const map: { start: number; end: number }[] = [];
  const entityRe = /^&(?:amp|lt|gt|quot|#39|nbsp);/;
  const blockCloseRe = /^<\/(?:p|div|h[1-6]|li|blockquote|tr)>/i;
  let i = 0;
  let lastWasSpace = true; // starts true to match stripHtml's trim behavior

  while (i < html.length) {
    if (html[i] === "<") {
      // Check if closing block tag → emit space
      const closeMatch = html.slice(i).match(blockCloseRe);
      if (closeMatch) {
        if (!lastWasSpace) {
          map.push({ start: i, end: i + closeMatch[0].length });
          lastWasSpace = true;
        }
        i += closeMatch[0].length;
        continue;
      }
      // Check for <br>
      const brMatch = html.slice(i).match(/^<br\s*\/?>/i);
      if (brMatch) {
        if (!lastWasSpace) {
          map.push({ start: i, end: i + brMatch[0].length });
          lastWasSpace = true;
        }
        i += brMatch[0].length;
        continue;
      }
      // Skip other tags
      while (i < html.length && html[i] !== ">") i++;
      i++;
      continue;
    }

    if (html[i] === "&") {
      const entityMatch = html.slice(i).match(entityRe);
      if (entityMatch) {
        map.push({ start: i, end: i + entityMatch[0].length });
        lastWasSpace = entityMatch[0] === "&nbsp;";
        i += entityMatch[0].length;
        continue;
      }
    }

    if (/\s/.test(html[i])) {
      if (!lastWasSpace) {
        // Consume all whitespace, map to single space
        const wsStart = i;
        while (i < html.length && /\s/.test(html[i]) && html[i] !== "<") i++;
        map.push({ start: wsStart, end: i });
        lastWasSpace = true;
      } else {
        i++;
      }
      continue;
    }

    map.push({ start: i, end: i + 1 });
    lastWasSpace = false;
    i++;
  }

  // Trim trailing space (mirrors stripHtml's .trim())
  if (map.length > 0 && lastWasSpace) {
    map.pop();
  }

  return map;
}

/**
 * Replace a segment's old text in HTML with new text.
 * Builds a plain-text → HTML position map to locate the exact HTML range.
 */
export function replaceSegmentTextInHtml(html: string, oldText: string, newText: string): string {
  if (oldText === newText) return html;

  const stripped = stripHtml(html);
  const plainIdx = stripped.indexOf(oldText);
  if (plainIdx === -1) return html;

  const map = buildPlainToHtmlMap(html);
  if (plainIdx >= map.length) return html;

  const htmlStart = map[plainIdx].start;
  const endIdx = Math.min(plainIdx + oldText.length - 1, map.length - 1);
  const htmlEnd = map[endIdx].end;

  return html.slice(0, htmlStart) + newText + html.slice(htmlEnd);
}
