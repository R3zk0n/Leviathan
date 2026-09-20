const itemDefaults = {
  isDecompiling: false,
  isDecompiled: false,
  lastEngine: null,
  isLoadingActivities: false,
  isLoadingServices: false,
  isLoadingReceivers: false,
  isLoadingProviders: false,
  isLoadingInfo: false,
  isLoadingExports: false,
  isLoadingImports: false,
  isLoadingSymbols: false,
  isLoadingFunctions: false,
  isLoadingClasses: false,
};

export function createDashboardItem(file) {
  return { ...itemDefaults, ...file };
}

export function mergeDashboardItems(files, previousItems = []) {
  const previousByApplication = new Map(
    previousItems.map(item => [item.application, item])
  );

  return files.map(file => {
    const previous = previousByApplication.get(file.application);
    // Keep existing row references so requests already updating a row still
    // update the displayed item after a background list refresh.
    return previous ? Object.assign(previous, file) : createDashboardItem(file);
  });
}

export function snapshotDashboardItems(items = []) {
  return items.map(item => {
    const snapshot = { ...itemDefaults, ...item, isDecompiling: false };
    if (item.scanData) snapshot.scanData = { ...item.scanData };
    // Action spinners belong to the current page instance, unlike completed
    // scan and decompile metadata that should survive navigation.
    for (const key of Object.keys(snapshot)) {
      if (key.startsWith('isLoading')) snapshot[key] = false;
    }
    return snapshot;
  });
}
