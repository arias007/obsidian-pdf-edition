export interface EditableTextFragment<TRun> {
  bottom: number;
  left: number;
  right: number;
  run: TRun;
  top: number;
}

export interface EditableTextLine<TRun> {
  bottom: number;
  fragments: Array<EditableTextFragment<TRun>>;
  left: number;
  right: number;
  top: number;
}

interface TextLineAccumulator<TRun> extends EditableTextLine<TRun> {
  center: number;
  centerTotal: number;
  height: number;
  heightTotal: number;
}

export function clusterEditableTextFragments<TRun>(
  fragments: Array<EditableTextFragment<TRun>>
): Array<EditableTextLine<TRun>> {
  const sorted = [...fragments].sort((a, b) => (
    ((a.top + a.bottom) - (b.top + b.bottom)) || (a.left - b.left)
  ));
  const lines: Array<TextLineAccumulator<TRun>> = [];

  for (const fragment of sorted) {
    const fragmentHeight = Math.max(1, fragment.bottom - fragment.top);
    const fragmentCenter = (fragment.top + fragment.bottom) / 2;
    const existing = lines
      .map((line) => {
        const overlap = Math.max(0, Math.min(line.bottom, fragment.bottom) - Math.max(line.top, fragment.top));
        const referenceHeight = Math.max(1, Math.min(line.height, fragmentHeight));
        const overlapRatio = overlap / referenceHeight;
        const centerDistance = Math.abs(line.center - fragmentCenter);
        const centerTolerance = Math.max(1.5, referenceHeight * 0.42);
        return {
          centerDistance,
          centerTolerance,
          line,
          overlapRatio,
          score: centerDistance / referenceHeight - overlapRatio
        };
      })
      .filter(({ centerDistance, centerTolerance, overlapRatio }) => (
        centerDistance <= centerTolerance || overlapRatio >= 0.62
      ))
      .sort((a, b) => a.score - b.score)[0]?.line;

    if (!existing) {
      lines.push({
        bottom: fragment.bottom,
        center: fragmentCenter,
        centerTotal: fragmentCenter,
        fragments: [fragment],
        height: fragmentHeight,
        heightTotal: fragmentHeight,
        left: fragment.left,
        right: fragment.right,
        top: fragment.top
      });
      continue;
    }

    existing.fragments.push(fragment);
    existing.bottom = Math.max(existing.bottom, fragment.bottom);
    existing.centerTotal += fragmentCenter;
    existing.center = existing.centerTotal / existing.fragments.length;
    existing.heightTotal += fragmentHeight;
    existing.height = existing.heightTotal / existing.fragments.length;
    existing.left = Math.min(existing.left, fragment.left);
    existing.right = Math.max(existing.right, fragment.right);
    existing.top = Math.min(existing.top, fragment.top);
  }

  return lines
    .sort((a, b) => (a.center - b.center) || (a.left - b.left))
    .map(({ center: _center, centerTotal: _centerTotal, height: _height, heightTotal: _heightTotal, ...line }) => line);
}
