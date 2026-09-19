/**
 * Resolve a vulnerability "entry method" / component string into a best-guess Android component class name.
 *
 * Goal: normalize rule-produced values like:
 *   - "<CustomClass: void Main_Entry_com_android_settings_search_SearchResultTrampoline()>"
 *   - "<com.foo.Bar: void onCreate()>"
 *   - "Lcom/foo/Bar;"
 *   - "com/foo/Bar.onCreate("
 * into a stable fully-qualified class name (FQCN) so we can link it to AndroidManifest.xml
 * and backend component-status endpoints.
 */

const stripAngles = (s) => String(s || '').replace(/^\s*<|>\s*$/g, '').trim();

const looksLikeFqcn = (s) => /^[A-Za-z_][\w$]*(\.[A-Za-z_][\w$]*)+$/.test(String(s || '').trim());

const outerClass = (fqcn) => {
  const s = String(fqcn || '').trim();
  if (!s) return '';
  return s.includes('$') ? s.split('$')[0] : s;
};

// Generate alternate spellings for inner/nested classes.
// Android manifests often use '$' for nested classes, while analysis rules may use '.' or vice-versa.
const innerClassVariants = (fqcn) => {
  const s = String(fqcn || '').trim();
  if (!s) return [];

  const out = [];

  // Dot -> Dollar, but only for the *last* segment if it looks like a nested class.
  // Example: com.android.settings.Settings.BluetoothFindBroadcastsActivity
  //      -> com.android.settings.Settings$BluetoothFindBroadcastsActivity
  if (!s.includes('$') && s.includes('.')) {
    const parts = s.split('.');
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      const prev = parts[parts.length - 2];
      // heuristic: nested class names in Java are typically Capitalized
      if (/^[A-Z]/.test(last) && /^[A-Z]/.test(prev)) {
        const dollar = [...parts.slice(0, -2), `${prev}$${last}`].join('.');
        out.push(dollar);
      }
    }
  }

  // Dollar -> Dot
  // Example: com.android.settings.Settings$BluetoothFindBroadcastsActivity
  //      -> com.android.settings.Settings.BluetoothFindBroadcastsActivity
  if (s.includes('$')) {
    out.push(s.replace(/\$/g, '.'));
  }

  return out;
};

const uniq = (arr) => {
  const out = [];
  const seen = new Set();
  for (const v of arr) {
    const s = String(v || '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
};

/**
 * @param {string} raw - entry_method or any free-form component identifier
 * @param {string} [fallback] - server-provided component_name if available
 * @returns {{ primary: string, candidates: string[] }}
 */
export const resolveComponentName = (raw, fallback = '') => {
  const candidates = [];

  // 1) Prefer backend-provided component name when it already looks valid.
  if (fallback && typeof fallback === 'string') {
    const cleaned = stripAngles(fallback);
    if (looksLikeFqcn(cleaned)) {
      candidates.push(cleaned);
      candidates.push(outerClass(cleaned));
      candidates.push(...innerClassVariants(cleaned));
    } else if (cleaned) {
      // Even if it doesn't look like a fqcn, keep it as a last-ditch candidate.
      candidates.push(cleaned);
    }
  }

  const text = String(raw || '').trim();
  if (text) {
    const cleanedRaw = stripAngles(text);

    // 2) CustomClass Main_Entry_...() signatures
    // Example: "CustomClass: void Main_Entry_com_android_settings_search_SearchResultTrampoline()"
    const mainEntry = cleanedRaw.match(/Main_Entry_([^()\s]+)/);
    if (mainEntry && mainEntry[1]) {
      const payload = String(mainEntry[1] || '').trim();

      // Primary heuristic: underscores are dots.
      const asDots = payload.replace(/_/g, '.').trim();
      if (asDots) {
        candidates.push(asDots);
        candidates.push(outerClass(asDots));
        candidates.push(...innerClassVariants(asDots));
      }

      // Resilience heuristic for inner classes:
      // Some rules encode nested classes as Outer_Inner (underscore) but manifest uses Outer$Inner.
      // We can't perfectly infer package vs class boundary, so we try safe transforms.
      // Strategy:
      //  - If the payload ends with "_InnerClass", treat the last '_' as a '$' (keep other '_' as '.')
      //    Example: com_android_settings_Settings_AppTurnScreenOnSettingsActivity
      //          -> com.android.settings.Settings$AppTurnScreenOnSettingsActivity
      const lastUnderscore = payload.lastIndexOf('_');
      if (lastUnderscore > 0 && lastUnderscore < payload.length - 1) {
        const before = payload.slice(0, lastUnderscore);
        const after = payload.slice(lastUnderscore + 1);
        const withDollar = `${before.replace(/_/g, '.')}\$${after}`.replace(/\$+/, '$').trim();
        if (withDollar) {
          candidates.push(withDollar);
          candidates.push(outerClass(withDollar));
          candidates.push(...innerClassVariants(withDollar));
        }
      }
    }

    // 3) Soot-ish: "com.foo.Bar: void baz()" -> take LHS before ':'
    if (cleanedRaw.includes(':')) {
      const lhs = cleanedRaw.split(':')[0].trim();
      if (lhs) {
        candidates.push(lhs);
        candidates.push(outerClass(lhs));
        candidates.push(...innerClassVariants(lhs));
      }
    }

    // 4) JVM type: Lcom/foo/Bar; -> com.foo.Bar
    const jvmType = cleanedRaw.match(/\bL([A-Za-z0-9_$/]+);/);
    if (jvmType && jvmType[1]) {
      const fqcn = jvmType[1].replace(/\//g, '.');
      candidates.push(fqcn);
      candidates.push(outerClass(fqcn));
      candidates.push(...innerClassVariants(fqcn));
    }

    // 5) Path-like: com/foo/Bar.something( -> com.foo.Bar
    const pathLike = cleanedRaw.match(/\b([A-Za-z0-9_]+(?:\/[A-Za-z0-9_]+)+)\b/);
    if (pathLike && pathLike[1]) {
      const dotted = pathLike[1].replace(/\//g, '.');
      candidates.push(dotted);
      candidates.push(outerClass(dotted));
      candidates.push(...innerClassVariants(dotted));
    }

    // 6) Tokenize and keep anything that looks like an fqcn
    for (const token of cleanedRaw.split(/[\s,();<>]+/g)) {
      if (looksLikeFqcn(token)) {
        candidates.push(token);
        candidates.push(outerClass(token));
        candidates.push(...innerClassVariants(token));
      }
    }
  }

  const unique = uniq(candidates);
  const primary = unique.find(looksLikeFqcn) || unique[0] || '';

  // Also add short-name form ".Foo" and simple name "Foo" so manifest lookup can match
  // cases where manifest uses shorthand.
  const shortForms = [];
  if (primary && typeof primary === 'string') {
    const simple = primary.split('.').pop();
    if (simple) {
      shortForms.push(`.${simple}`);
      shortForms.push(simple);
    }
  }

  const all = uniq([...unique, ...shortForms]);
  return { primary, candidates: all };
};
