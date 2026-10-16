/**
 * Whether the page has changes that aren't saved, so links that leave it (the
 * app's navigation and Sign out) can ask first. Reloading or closing the tab
 * is covered by the drafting page's `beforeunload` handler.
 */
let unsaved = false;

export function setUnsavedChanges(value: boolean) {
  unsaved = value;
}

/** Whether to go ahead and leave the page: true unless the user chooses to stay with unsaved changes. */
export function confirmLeave(): boolean {
  return !unsaved || window.confirm("You have unsaved changes. Leave without saving them?");
}
