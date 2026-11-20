export function versionMetadata(runtime) {
  const installer = {
    version: runtime.installer.version,
    minInstallerVersion: runtime.installer.version,
    minRunnableInstallerVersion: runtime.installer.version,
    maxInstallerVersion: runtime.installer.version,
    isBeta: false,
    downloads: { appImage: `https://invalid.invalid/pinned-runtime/${runtime.installer.version}.AppImage` },
    installers: {
      appImage: {
        digest: `sha256:${runtime.installer.sha256}`,
        electron: runtime.installer.electron,
        chrome: runtime.installer.chrome,
        platforms: ["linux-x64"],
      },
    },
    electronVersion: runtime.installer.electron,
    chromeVersion: runtime.installer.chrome,
  };
  const app = {
    version: runtime.app.version,
    minInstallerVersion: runtime.app.minInstallerVersion,
    minRunnableInstallerVersion: runtime.app.minInstallerVersion,
    maxInstallerVersion: runtime.app.maxInstallerVersion,
    isBeta: false,
    downloads: { asar: `https://invalid.invalid/pinned-runtime/${runtime.app.version}.asar.gz` },
    installers: {},
  };

  // The launcher selects the first record for a version. Equal app/installer
  // versions must expose both assets in that record, not shadow each other.
  if (app.version === installer.version) {
    return [{ ...installer, ...app, downloads: { ...installer.downloads, ...app.downloads }, installers: installer.installers }];
  }
  return [installer, app].sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));
}
