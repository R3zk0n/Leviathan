// Display grouping only: retain the original instruction objects and ordering.
function lowerBound(instructions, address) {
  let low = 0;
  let high = instructions.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (instructions[middle].address < address) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function groupInstructionsByRanges(instructions, basicBlockBoundaries) {
  // Keep the existing stable sorts, including their legacy coercion behavior.
  const sortedInstructions = [...instructions].sort((a, b) => a.address - b.address);
  const boundaries = [...basicBlockBoundaries].sort((a, b) => a[0] - b[0]);
  if (!boundaries.length) return [];

  const indexable = sortedInstructions.every(instruction => Number.isFinite(instruction?.address))
    && boundaries.every(boundary => Array.isArray(boundary)
      && Number.isFinite(boundary[0]) && Number.isFinite(boundary[1]));

  // Non-numeric/non-finite data must retain the old comparison semantics.
  if (!indexable) {
    return boundaries.map(([start, end]) => sortedInstructions.filter(
      instruction => instruction.address >= start && instruction.address < end,
    )).filter(block => block.length > 0);
  }

  return boundaries.map(([start, end]) => {
    if (end <= start) return [];
    return sortedInstructions.slice(
      lowerBound(sortedInstructions, start), lowerBound(sortedInstructions, end),
    );
  }).filter(block => block.length > 0);
}
