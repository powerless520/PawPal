import { app } from "electron";
import type { UpdateCheckResult } from "../shared/types";
import { RELEASES_URL } from "./config";

export function createInitialUpdateCheck(): UpdateCheckResult {
  return {
    status: "idle",
    currentVersion: app.getVersion(),
    latestVersion: null,
    releaseUrl: RELEASES_URL,
    checkedAt: null,
    error: null
  };
}

export function createCheckingUpdateCheck(current: UpdateCheckResult): UpdateCheckResult {
  return {
    ...current,
    status: "checking",
    currentVersion: app.getVersion(),
    checkedAt: Date.now(),
    error: null
  };
}

// Local-only fork: GitHub release polling is disabled.
// `app:check-for-updates` IPC and the launch-time check both short-circuit
// to a stable "up-to-date" result so the UI never pings the network.
export async function checkGitHubReleasesForUpdates(
  current: UpdateCheckResult
): Promise<UpdateCheckResult> {
  return {
    ...current,
    status: "up-to-date",
    currentVersion: app.getVersion(),
    checkedAt: Date.now(),
    error: null
  };
}
