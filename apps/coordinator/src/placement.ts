export function chooseNodes<T>(nodes: T[], count: number, offset: number): T[] {
  if (nodes.length < count) {
    return [];
  }
  return Array.from({ length: count }, (_, index) => nodes[(offset + index) % nodes.length]!);
}
