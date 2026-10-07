export const OPEN_COMMAND_PALETTE_EVENT = "sol-planner:open-command-palette";

export function openCommandPalette() {
  document.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
}