// Android callback signature index used for hover tooltips in CodeViewer.
//
// Goal: Provide Android-Studio-like signature previews (lightweight, offline).
// This is intentionally small and curated. We can grow it over time.

/**
 * @typedef {{
 *  displayClass?: string,
 *  name: string,
 *  modifiers?: string,
 *  returnType?: string,
 *  params: Array<{ type: string, name: string }>,
 *  docFqcn?: string,
 *  docPath?: string,
 *  docAnchor?: string,
 * }} AndroidCallbackSignature
 */

/** @type {Record<string, AndroidCallbackSignature>} */
export const ANDROID_CALLBACK_SIGNATURES = {
  onActivityResult: {
    displayClass: 'android.app.Activity',
    name: 'onActivityResult',
    modifiers: 'protected',
    returnType: 'void',
    params: [
      { type: 'int', name: 'requestCode' },
      { type: 'int', name: 'resultCode' },
      { type: 'android.content.Intent', name: 'data' }
    ],
    docFqcn: 'android.app.Activity',
    docAnchor: 'onActivityResult(int,%20int,%20android.content.Intent)'
  },
  onCreate: {
    displayClass: 'android.app.Activity',
    name: 'onCreate',
    modifiers: 'protected',
    returnType: 'void',
    params: [{ type: 'android.os.Bundle', name: 'savedInstanceState' }],
    docFqcn: 'android.app.Activity',
    docAnchor: 'onCreate(android.os.Bundle)'
  },
  onStart: {
    displayClass: 'android.app.Activity',
    name: 'onStart',
    modifiers: 'protected',
    returnType: 'void',
    params: [],
    docFqcn: 'android.app.Activity'
  },
  onResume: {
    displayClass: 'android.app.Activity',
    name: 'onResume',
    modifiers: 'protected',
    returnType: 'void',
    params: [],
    docFqcn: 'android.app.Activity'
  },
  onPause: {
    displayClass: 'android.app.Activity',
    name: 'onPause',
    modifiers: 'protected',
    returnType: 'void',
    params: [],
    docFqcn: 'android.app.Activity'
  },
  onStop: {
    displayClass: 'android.app.Activity',
    name: 'onStop',
    modifiers: 'protected',
    returnType: 'void',
    params: [],
    docFqcn: 'android.app.Activity'
  },
  onDestroy: {
    displayClass: 'android.app.Activity',
    name: 'onDestroy',
    modifiers: 'protected',
    returnType: 'void',
    params: [],
    docFqcn: 'android.app.Activity'
  },
  onRequestPermissionsResult: {
    displayClass: 'android.app.Activity',
    name: 'onRequestPermissionsResult',
    modifiers: 'public',
    returnType: 'void',
    params: [
      { type: 'int', name: 'requestCode' },
      { type: 'java.lang.String[]', name: 'permissions' },
      { type: 'int[]', name: 'grantResults' }
    ],
    docFqcn: 'android.app.Activity',
    docAnchor: 'onRequestPermissionsResult(int,%20java.lang.String[],%20int[])'
  }
};

export function formatAndroidCallbackSignature(sig) {
  const mods = sig.modifiers ? sig.modifiers + ' ' : '';
  const ret = sig.returnType ? sig.returnType + ' ' : '';
  const params = (sig.params || [])
    .map(p => `${simpleType(p.type)} ${p.name}`.trim())
    .join(', ');
  return `${mods}${ret}${sig.name}(${params})`;
}

function simpleType(t) {
  if (!t) return '';
  // Keep primitive types as-is. For FQCNs, show last segment.
  if (!t.includes('.')) return t;
  // arrays
  if (t.endsWith('[]')) {
    const base = t.slice(0, -2);
    return simpleType(base) + '[]';
  }
  const parts = t.split('.').filter(Boolean);
  return parts[parts.length - 1];
}
