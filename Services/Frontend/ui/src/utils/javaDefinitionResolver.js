// Lightweight Java "go to definition" resolver for decompiled sources.
//
// Contract:
// - resolveJavaDefinition({ token, currentComponentName, currentCode })
//   returns { targetComponentName, targetPos, isLocal, candidates } or null.
//
// Strategy (evaluated in priority order):
//  1. Method / field declaration in the current file
//  2. Class / interface / enum / record declaration in the current file
//  3. Direct import match:  import com.foo.Bar  →  Bar
//  4. Wildcard import match: import com.foo.*  →  com.foo.Bar
//  5. Outer-class inner navigation: Outer.Inner  →  pkg.Outer$Inner
//  6. Token is already an FQN (dotted)
//  7. Same-package guess:  package com.foo  +  Bar  →  com.foo.Bar
//
// Android/Java SDK classes are detected and excluded from cross-file navigation
// (they're not in decompiled sources).

// ─── Utilities ───────────────────────────────────────────────────────────────

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Returns the simple class name from a dotted token, e.g. com.foo.Bar → Bar */
function lastIdentifierPart(token) {
  if (!token) return '';
  const cleaned = token.replace(/\(.*$/, '').replace(/;$/, '').trim();
  const parts = cleaned.split('.').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : cleaned;
}

function isLikelyFqn(token) {
  return /^[a-zA-Z_$][\w$]*(\.[a-zA-Z_$][\w$]*)+$/.test(token || '');
}

/**
 * Returns true for Android/Java platform classes that won't exist in
 * the decompiled output — no point trying to navigate to them.
 */
function isPlatformClass(fqn) {
  return /^(java\.|javax\.|android\.|androidx\.|dalvik\.|kotlin\.|kotlinx\.|com\.google\.android\.|org\.jetbrains\.|sun\.|com\.android\.)/.test(fqn || '');
}

function extractPackage(javaCode) {
  const m = javaCode.match(/^[\t ]*package\s+([\w$.]+)\s*;/m);
  return m ? m[1] : '';
}

function extractImports(javaCode) {
  const imports = [];
  const re = /^[\t ]*import\s+(static\s+)?([\w$.]+)\s*;/gm;
  let m;
  while ((m = re.exec(javaCode)) !== null) {
    imports.push({ fqn: m[2], isStatic: !!m[1] });
  }
  return imports;
}

function extractWildcardPackages(javaCode) {
  const packages = [];
  const re = /^[\t ]*import\s+(?:static\s+)?([\w$.]+)\.\*\s*;/gm;
  let m;
  while ((m = re.exec(javaCode)) !== null) {
    packages.push(m[1]);
  }
  return packages;
}

function getLineAtPos(javaCode, pos) {
  if (!javaCode || typeof pos !== 'number') return '';
  let start = pos;
  let end = pos;
  while (start > 0 && javaCode[start - 1] !== '\n') start--;
  while (end < javaCode.length && javaCode[end] !== '\n') end++;
  return javaCode.slice(start, end);
}

function inferClassFromLine(lineText, methodName) {
  if (!lineText || !methodName) return '';
  const esc = escapeRegExp(methodName);

  // new ClassName().method(...)
  const ctorRe = new RegExp(`new\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\.\s*${esc}\b`);
  const ctorMatch = lineText.match(ctorRe);
  if (ctorMatch && ctorMatch[1]) return ctorMatch[1];

  // ClassName.method(...)
  const staticRe = new RegExp(`([A-Za-z_$][\w$]*)\s*\.\s*${esc}\b`);
  const staticMatch = lineText.match(staticRe);
  if (staticMatch && staticMatch[1]) {
    const candidate = staticMatch[1];
    if (/^[A-Z]/.test(candidate)) return candidate;
  }

  return '';
}

// ─── In-file position finders ────────────────────────────────────────────────

/**
 * Find a class/interface/enum/record declaration in the current file.
 * Returns the character offset of the declaration start, or null.
 */
function findClassDeclarationPos(javaCode, className) {
  if (!javaCode || !className) return null;
  const re = new RegExp(
    `(^|\\n)[\\t ]*(?:(?:public|protected|private|abstract|final|static|sealed|non-sealed|strictfp)\\s+)*` +
    `(?:class|interface|enum|@interface|record)\\s+${escapeRegExp(className)}\\b`,
    'm'
  );
  const m = re.exec(javaCode);
  if (!m) return null;
  return m.index + (m[1] ? m[1].length : 0);
}

/**
 * Find a method or field declaration in the current file by simple name.
 * Matches patterns like:
 *   void foo(   /   Type foo(   /   private Type foo =   /   Type foo;
 * Returns character offset or null.
 */
function findMemberDeclarationPos(javaCode, memberName) {
  if (!javaCode || !memberName) return null;

  const esc = escapeRegExp(memberName);

  // Method declaration: modifiers? returnType memberName(
  const methodRe = new RegExp(
    `(^|\\n)[\\t ]*(?:(?:public|protected|private|static|final|abstract|synchronized|native|default|override)\\s+)*` +
    `[\\w$<>\\[\\],?\\s]+?\\s+${esc}\\s*\\(`,
    'm'
  );
  const mMethod = methodRe.exec(javaCode);
  if (mMethod) return mMethod.index + (mMethod[1] ? mMethod[1].length : 0);

  // Field declaration: modifiers? Type memberName [=;]
  const fieldRe = new RegExp(
    `(^|\\n)[\\t ]*(?:(?:public|protected|private|static|final|volatile|transient)\\s+)+` +
    `[\\w$<>\\[\\],?\\s]+?\\s+${esc}\\s*[=;]`,
    'm'
  );
  const mField = fieldRe.exec(javaCode);
  if (mField) return mField.index + (mField[1] ? mField[1].length : 0);

  return null;
}

// ─── Main resolver ────────────────────────────────────────────────────────────

/**
 * @param {Object} args
 * @param {string} args.token               – selected / hovered text
 * @param {string} args.currentComponentName – current file's FQN (e.g. com.acme.MainActivity)
 * @param {string} args.currentCode          – full Java source of the current file
 * @returns {{targetComponentName: string, targetPos: number, isLocal: boolean, candidates: string[]}|null}
 *
 * `candidates` is an ordered list of FQNs the caller can try in sequence if
 * the first one 404s from the backend.
 */
export function resolveJavaDefinition({ token, currentComponentName, currentCode, position, preferClass = false }) {
  if (!token || !currentCode) return null;

  const trimmed = token.trim();
  if (!trimmed || trimmed.length < 2) return null;

  // ── Strip common suffixes that may be selected ────────────────────────────
  // e.g. "FooActivity.class", "FooActivity::bar"
  const clean = trimmed.replace(/\.class$/, '').replace(/::.*$/, '').trim();

  const simpleToken = lastIdentifierPart(clean);

  if (!preferClass) {
    // ── Strategy 1: member (method/field) declaration in current file ─────────
    const memberPos = findMemberDeclarationPos(currentCode, simpleToken);
    if (memberPos !== null) {
      return {
        targetComponentName: currentComponentName,
        targetPos: memberPos,
        isLocal: true,
        candidates: [],
      };
    }
  }

  // ── Strategy 2: class/interface declaration in current file ───────────────
  const localPos = findClassDeclarationPos(currentCode, simpleToken);
  if (localPos !== null) {
    return {
      targetComponentName: currentComponentName,
      targetPos: localPos,
      isLocal: true,
      candidates: [],
    };
  }

  const lineText = getLineAtPos(currentCode, position);
  const inferredClass = inferClassFromLine(lineText, simpleToken);

  const imports = extractImports(currentCode);
  const wildcardPkgs = extractWildcardPackages(currentCode);
  const pkg = extractPackage(currentCode);

  // Collect all candidate FQNs that the backend can be queried with in order.
  const candidates = [];

  const candidateToken = inferredClass || simpleToken;

  // ── Strategy 3: direct import match ──────────────────────────────────────
  const direct = imports.find(i => {
    const parts = i.fqn.split('.');
    return parts[parts.length - 1] === candidateToken;
  });
  if (direct) {
    // If this token is explicitly imported from a platform package (android.*,
    // java.*, etc.) there is no decompiled source to navigate to — return null
    // immediately so Strategy 7 cannot accidentally guess a same-package FQN.
    if (isPlatformClass(direct.fqn)) return null;
    candidates.push(direct.fqn);
  }

  // ── Strategy 4: wildcard import packages → pkg.SimpleToken ───────────────
  for (const wpkg of wildcardPkgs) {
    const candidate = `${wpkg}.${candidateToken}`;
    if (!isPlatformClass(candidate) && !candidates.includes(candidate)) {
      candidates.push(candidate);
    }
  }

  // ── Strategy 5: Outer.Inner → handle dotted token ─────────────────────────
  //   e.g. "Builder" inside "com.foo.Foo.Builder" → try com.foo.Foo$Builder
  if (clean.includes('.') && !isLikelyFqn(clean)) {
    // Token like "Response.Builder" — resolve the outer from imports/package
    const outerName = clean.split('.')[0];
    const outerImport = imports.find(i => i.fqn.endsWith('.' + outerName));
    if (outerImport) {
      const innerFqn = `${outerImport.fqn}$${lastIdentifierPart(clean)}`;
      if (!isPlatformClass(innerFqn) && !candidates.includes(innerFqn)) {
        candidates.push(innerFqn);
      }
      // Also try the dotted form (some decompilers use dots for inner classes)
      const dottedFqn = `${outerImport.fqn}.${lastIdentifierPart(clean)}`;
      if (!isPlatformClass(dottedFqn) && !candidates.includes(dottedFqn)) {
        candidates.push(dottedFqn);
      }
    }
  }

  // ── Strategy 6: token is already a full FQN ───────────────────────────────
  if (isLikelyFqn(clean) && !isPlatformClass(clean)) {
    if (!candidates.includes(clean)) candidates.push(clean);
  }

  // ── Strategy 7: same-package guess ───────────────────────────────────────
  if (pkg) {
    const samePkg = `${pkg}.${candidateToken}`;
    if (!isPlatformClass(samePkg) && !candidates.includes(samePkg)) {
      candidates.push(samePkg);
    }
  }

  if (candidates.length === 0) return null;

  return {
    targetComponentName: candidates[0],
    targetPos: 0,
    isLocal: false,
    candidates,
  };
}
