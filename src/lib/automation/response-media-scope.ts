/** Partition a shared response's connected media for a scoped edit.
 * An edit never implicitly changes a media item not explicitly included.
 */
export function partitionResponseMediaScope(previousIds: Iterable<string>, selectedIds: Iterable<string>) {
  const previous = Array.from(new Set(Array.from(previousIds).filter(Boolean)));
  const selected = Array.from(new Set(Array.from(selectedIds).filter(Boolean)));
  const previousSet = new Set(previous);
  const appliedExistingIds = selected.filter((id) => previousSet.has(id));
  const untouchedIds = previous.filter((id) => !appliedExistingIds.includes(id));
  const addedIds = selected.filter((id) => !previousSet.has(id));
  return {
    appliedExistingIds,
    untouchedIds,
    addedIds,
    splitShared: untouchedIds.length > 0,
  };
}
