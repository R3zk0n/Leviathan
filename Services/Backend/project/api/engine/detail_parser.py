"""
parse_appshark_detail(html: str) -> dict

Parses an Appshark vulnerability detail HTML file into structured JSON so the
frontend never has to touch raw HTML.

Appshark writes one HTML file per vulnerability under:
  <scan_root>/<app>/vulnerability/<id>.html

The HTML contains plain-text sections separated by labelled headings.  The
useful sections are:

  data flow:          one "<Class: method>->$var" line per tainted entry point
  call stack:         one "<Class: method>" line per hop, in call order
  code detail:        per-method Jimple IR blocks with [Source]/[Sink]/[N] markers
  java source code:   per-method decompiled Java (JADX output re-used by Appshark)

Return shape
------------
{
  "callStack": [
    { "fqClassName": str, "simpleClassName": str, "methodName": str, "methodSig": str }
  ],
  "blocks": [
    {
      "methodSig":  str,          # full Jimple sig  "<pkg.Class: ret method(params)>"
      "methodName": str,          # e.g. "d"
      "label":      str,          # e.g. "d()"
      "fqClassName": str,
      "simpleClassName": str,
      "jimple": [
        {
          "lineNum": int | None,
          "type":    "source" | "sink" | "propagation" | "through" | "plain",
          "text":    str,          # raw Jimple text, HTML-entities decoded
          "token":   str | None,   # Java-visible token (method name or class name for ctors)
          "isConstructor": bool,
          "isReturn": bool,
          "tainted": [str]         # tainted register names present on this line
        }
      ],
      "javaSource": str            # raw Java source text for this method block
    }
  ]
}
"""

import re
import html as html_module
from project.report_html import sanitize_report_html


# ---------------------------------------------------------------------------
# HTML stripping
# ---------------------------------------------------------------------------

_TAG_RE    = re.compile(r'<[^>]+>')
_ENTITY_RE = re.compile(r'&(?:lt|gt|amp|quot|#\d+);')

def _strip_html(text: str) -> str:
    """Remove HTML tags and decode common entities."""
    text = _TAG_RE.sub('', text)
    text = text.replace('&lt;', '<').replace('&gt;', '>') \
               .replace('&amp;', '&').replace('&quot;', '"') \
               .replace('&#39;', "'").replace('&nbsp;', ' ')
    return text


# ---------------------------------------------------------------------------
# Section extraction
# ---------------------------------------------------------------------------

# Section names as they appear in the HTML (case-insensitive)
_SECTION_PATTERNS = [
    'data flow',
    'call stack',
    'code detail',
    'java source code',
]

def _extract_sections(plain: str) -> dict:
    """
    Split plain text into named sections.

    Each section starts at a heading line that matches one of the known labels
    (optionally followed by ':') and ends where the next heading starts or at EOF.

    Returns { section_name_lower: text_content, ... }
    """
    # Build a regex that matches any section heading
    pattern = re.compile(
        r'(?:^|\n)\s*(' +
        '|'.join(re.escape(s) for s in _SECTION_PATTERNS) +
        r')\s*:?\s*\n',
        re.IGNORECASE,
    )

    sections = {}
    matches  = list(pattern.finditer(plain))

    for i, m in enumerate(matches):
        name  = m.group(1).strip().lower()
        start = m.end()
        end   = matches[i + 1].start() if i + 1 < len(matches) else len(plain)
        sections[name] = plain[start:end]

    return sections


# ---------------------------------------------------------------------------
# Method signature helpers
# ---------------------------------------------------------------------------

_SIG_RE = re.compile(r'^<([^:>]+):\s*\S+\s+(\w[\w$]*)\s*\(([^)]*)\)>')

def _parse_sig(sig: str) -> dict | None:
    """
    Parse a full Jimple method signature.

    Input:  "<pkg.Class: RetType methodName(params)>"
    Output: { fqClassName, simpleClassName, methodName, params, methodSig }
    """
    m = _SIG_RE.match(sig.strip())
    if not m:
        return None
    fq     = m.group(1).strip()
    method = m.group(2)
    params = m.group(3)
    simple = fq.split('.')[-1].split('$')[-1]
    return {
        'fqClassName':   fq,
        'simpleClassName': simple,
        'methodName':    method,
        'params':        params,
        'methodSig':     f'<{fq}: {sig.split(":", 1)[1].strip().rstrip(">")}>' if ':' in sig else sig,
    }


def _make_label(method_name: str, params: str) -> str:
    """Short human-readable label, e.g. 'd()' or 'f(String,InputStream,a)'."""
    if not params.strip():
        return f'{method_name}()'
    # Use only simple class names from params
    short_params = ','.join(p.strip().split('.')[-1] for p in params.split(','))
    return f'{method_name}({short_params})'


# ---------------------------------------------------------------------------
# Jimple token extraction
# ---------------------------------------------------------------------------

def _extract_java_token(line: str) -> tuple[str | None, bool, bool]:
    """
    Extract the Java-visible token for a Jimple annotated line.

    Returns (token, is_constructor, is_return).

    Three cases:
      1. Return propagation  "[N] return $var"  → (None, False, True)
      2. Constructor call    <pkg.ClassName: void <init>(...)>  → (simpleClassName, True, False)
      3. Regular method call <Class: RetType method(...)>       → (methodName, False, False)
    """
    # Return propagation
    if re.search(r'\[\d+\]\s*return\b', line):
        return None, False, True

    # Constructor: method is <init>
    m = re.search(r'<([\w$.]+):\s*\S+\s+<init>\(', line)
    if m:
        simple = m.group(1).split('.')[-1].split('$')[-1]
        return simple, True, False

    # Regular method call
    m = re.search(r'<[^>]+:\s*\S+\s+(\w+)\(', line)
    if m:
        return m.group(1), False, False

    return None, False, False


# ---------------------------------------------------------------------------
# Tainted-variable tracking
# ---------------------------------------------------------------------------

_VAR_BOUNDARY = re.compile(r'(?<![\w$])({var})(?![\w$])')

def _var_re(v: str) -> re.Pattern:
    safe = re.escape(v)
    return re.compile(r'(?<![\w$])' + safe + r'(?![\w$])')

def _line_contains_var(line: str, var: str) -> bool:
    return bool(_var_re(var).search(line))


# ---------------------------------------------------------------------------
# HTML-structure-aware code-detail extractor
# ---------------------------------------------------------------------------
#
# Appshark HTML interleaves blocks in this repeating pattern inside the
# code-detail <div>:
#
#   <pre><code>            ← bgheader block: <div class="bgheader…">SIG->VAR</div> lines
#   <pre><code>            ← Jimple block: numbered Jimple lines for the preceding sig
#   <div>…java source…    ← optional inline Java source for this method
#   (repeat for next method)
#
# Using plain-text section extraction fails because the "java source code:"
# labels appear multiple times, truncating the "code detail" section after
# the first method and discarding every subsequent block.  We parse the HTML
# structure directly instead.
# ---------------------------------------------------------------------------

_METHOD_HEADER_RE = re.compile(
    r'^(<[^>]+:\s*\S+\s+\w[\w$]*\s*\([^)]*\)>)\s*->'
)
_JIMPLE_LINE_RE = re.compile(r'^\d+:|^LABEL')

_CODE_DETAIL_START_RE = re.compile(
    r'<[^>]+class="vulnerability-detail"[^>]*>\s*code\s+detail',
    re.IGNORECASE,
)
_BGHEADER_IN_BLOCK_RE = re.compile(r'class="bgheader', re.IGNORECASE)
# Match a <div> wrapper that contains the java source label + its <pre><code>
# Appshark wraps each java snippet as:
#   <div><a class="vulnerability-detail">java source code:</a>
#        <pre><code class="java">...</code></pre></div>
_JAVA_DIV_RE = re.compile(
    r'<div>\s*<a[^>]+class="vulnerability-detail"[^>]*>\s*java\s+source\s+code[^<]*</a>'
    r'\s*<pre[^>]*>\s*<code[^>]*>(.*?)</code>\s*</pre>\s*</div>',
    re.DOTALL | re.IGNORECASE,
)

# Standalone <pre><code> blocks (header divs and Jimple blocks)
_PRE_CODE_RE = re.compile(
    r'<pre[^>]*>\s*<code[^>]*>(.*?)</code>\s*</pre>',
    re.DOTALL | re.IGNORECASE,
)


def _extract_raw_blocks_from_html(html: str) -> list[dict]:
    """
    Walk the code-detail section of the Appshark HTML and produce raw block
    records: { 'sig': str, 'jimple': [str], 'java_text': str }.

    Appshark HTML structure inside code-detail repeats as:
      <pre><code>  bgheader divs (data-flow refs for this block)  </code></pre>
      <pre><code>  Jimple lines for the method                     </code></pre>
      <div>
        <a class="vulnerability-detail">java source code:</a>
        <pre><code>  Java source snippet                            </code></pre>
      </div>
      (repeat for next method)

    We parse by first extracting all java-source divs (which are unambiguously
    labelled), marking their positions, then walking the remaining <pre><code>
    blocks. This avoids false positives from the "java source code:" label
    appearing after a <pre> that is NOT the source block.
    """
    cd_m = _CODE_DETAIL_START_RE.search(html)
    if not cd_m:
        return []
    work = html[cd_m.start():]

    # ── Pass 1: collect all java source snippets and their byte ranges ────────
    java_snippets = {}  # start_pos -> text
    for jm in _JAVA_DIV_RE.finditer(work):
        java_snippets[jm.start()] = _strip_html(jm.group(1))

    java_positions = sorted(java_snippets)

    # ── Pass 2: walk standalone <pre><code> blocks ────────────────────────────
    raw_blocks  = []
    pending_sig = None

    for pm in _PRE_CODE_RE.finditer(work):
        # Skip if this <pre> is inside a java-source <div> (already captured)
        if any(jp <= pm.start() < jp + 2000 for jp in java_positions):
            continue

        content_html = pm.group(1)

        if _BGHEADER_IN_BLOCK_RE.search(content_html):
            # Header block — extract the first method sig
            plain = _strip_html(content_html)
            for line in plain.split('\n'):
                hm = _METHOD_HEADER_RE.match(line.strip())
                if hm:
                    pending_sig = hm.group(1)
                    break
            continue

        # Plain Jimple block
        plain = _strip_html(content_html)
        jimple_lines = [
            ln.strip() for ln in plain.split('\n')
            if _JIMPLE_LINE_RE.match(ln.strip())
        ]
        if jimple_lines and pending_sig:
            raw_blocks.append({
                'sig':       pending_sig,
                'jimple':    jimple_lines,
                'java_text': '',
            })
            pending_sig = None

    # ── Pass 3: attach java snippets to their corresponding raw block ─────────
    # Each java div immediately follows the Jimple block it describes, so we
    # pair them by insertion order.
    for i, jp in enumerate(java_positions):
        if i < len(raw_blocks) and not raw_blocks[i]['java_text']:
            raw_blocks[i]['java_text'] = java_snippets[jp]

    return raw_blocks


def _parse_code_detail(raw_blocks: list[dict]) -> list[dict]:
    """
    Run two-pass taint analysis on a list of raw blocks produced by
    _extract_raw_blocks_from_html.

    Returns a list of block dicts:
      { methodSig, methodName, label, fqClassName, simpleClassName, jimple, javaSource }
    """
    # ── Two-pass taint analysis per block ────────────────────────────────────
    result = []

    for rb in raw_blocks:
        sig_info = _parse_sig(rb['sig'])
        if not sig_info:
            continue

        jimple_lines = rb['jimple']
        tainted_vars  = set()
        annotated_set = set()  # raw line text that has an explicit marker
        pass1         = []     # { idx, type, token, is_ctor, is_return }

        # Pass 1: explicit markers
        for idx, line in enumerate(jimple_lines):
            is_source = bool(re.search(r'\[Source\]', line))
            is_sink   = bool(re.search(r'\[Sink\]',   line))
            is_prop   = bool(re.search(r'\[\d+\]', line) and re.match(r'\d+:->', line))

            if not (is_source or is_sink or is_prop):
                continue

            annotated_set.add(line)
            token, is_ctor, is_ret = _extract_java_token(line)

            entry_type = 'source' if is_source else 'sink' if is_sink else 'propagation'
            pass1.append({
                'idx':          idx,
                'type':         entry_type,
                'token':        token,
                'is_ctor':      is_ctor,
                'is_return':    is_ret,
            })

            # Collect tainted LHS for source/propagation assignments
            if is_source:
                lhs = re.search(r'\[Source\]\s*(\$?\w+)\s*=', line)
                if lhs:
                    tainted_vars.add(lhs.group(1))
            if is_prop:
                lhs = re.search(r'\[\d+\]\s*(\$?\w+)\s*:?=', line)
                if lhs:
                    tainted_vars.add(lhs.group(1))

        # Back-fill tainted vars from sink argument lists
        for e in pass1:
            if e['type'] != 'sink':
                continue
            line = jimple_lines[e['idx']]
            # Match final argument list of virtualinvoke/specialinvoke/staticinvoke
            args_m = re.search(
                r'(?:virtualinvoke|specialinvoke|staticinvoke)[^(]+\(([^)]+)\)\s*$',
                line
            )
            if not args_m:
                # Fallback: last (...)
                args_m = re.search(r'\(([^)]+)\)\s*$', line)
            if args_m:
                for a in args_m.group(1).split(','):
                    v = a.strip()
                    if re.match(r'^\$?\w+$', v):
                        tainted_vars.add(v)

        # Pass 2: annotate all lines
        tainted_arr = list(tainted_vars)
        jimple_out  = []

        for idx, line in enumerate(jimple_lines):
            if not _JIMPLE_LINE_RE.match(line):
                continue

            tainted_here = [v for v in tainted_arr if _line_contains_var(line, v)]

            if line in annotated_set:
                e = next((x for x in pass1 if jimple_lines[x['idx']] == line), None)
                if e:
                    # Parse line number
                    ln_m = re.match(r'^(\d+):', line)
                    jimple_out.append({
                        'lineNum':       int(ln_m.group(1)) if ln_m else None,
                        'type':          e['type'],
                        'text':          line,
                        'token':         e['token'],
                        'isConstructor': e['is_ctor'],
                        'isReturn':      e['is_return'],
                        'tainted':       tainted_here,
                    })
            else:
                # Unannotated — emit as 'through' only if tainted variable present
                if tainted_here:
                    ln_m = re.match(r'^(\d+):', line)
                    jimple_out.append({
                        'lineNum':       int(ln_m.group(1)) if ln_m else None,
                        'type':          'through',
                        'text':          line,
                        'token':         None,
                        'isConstructor': False,
                        'isReturn':      False,
                        'tainted':       tainted_here,
                    })

        result.append({
            'methodSig':       rb['sig'],
            'methodName':      sig_info['methodName'],
            'label':           _make_label(sig_info['methodName'], sig_info['params']),
            'fqClassName':     sig_info['fqClassName'],
            'simpleClassName': sig_info['simpleClassName'],
            'jimple':          jimple_out,
            'javaSource':      rb.get('java_text', ''),
        })

    return result


# ---------------------------------------------------------------------------
# Java source extractor
# ---------------------------------------------------------------------------

_CLASS_HEADER_RE = re.compile(r'^\s*class\s+([\w$.]+)\s*\{')

def _split_java_source(java_text: str) -> list[dict]:
    """
    Split the java source text into per-class snippets.

    The same class can appear multiple times (once per method snippet).
    Returns [{ fqClass, lines: [str] }]
    """
    blocks   = []
    cur_fq   = None
    cur_lines = []

    def flush():
        if cur_fq and cur_lines:
            blocks.append({'fqClass': cur_fq, 'lines': list(cur_lines)})

    for raw in java_text.split('\n'):
        line = raw.rstrip()
        m = _CLASS_HEADER_RE.match(line)
        if m:
            flush()
            cur_fq    = m.group(1)
            cur_lines = [line]
        elif cur_fq is not None:
            cur_lines.append(line)

    flush()
    return blocks


def _attach_java_source(blocks: list[dict], java_text: str) -> None:
    """
    Match each code-detail block to its Java source snippet and attach it.

    Matching strategy:
      1. fqClassName must equal the snippet's fqClass
      2. The snippet must contain the method name as a whole-word token
         (disambiguates multiple snippets for the same class, one per method)

    Mutates blocks in-place (sets 'javaSource').
    """
    java_snippets = _split_java_source(java_text)

    for block in blocks:
        method_name = block['methodName']

        # Extract the return type simple name from the Jimple sig so we can
        # build a more specific pattern: "RetType methodName(" rather than
        # just "methodName(". This is critical for obfuscated code where
        # single-letter method names (a, b, c) appear dozens of times per class.
        ret_type_simple = None
        ret_m = re.search(r':\s*(\S+)\s+' + re.escape(method_name) + r'\s*\(', block['methodSig'])
        if ret_m:
            ret_type_simple = ret_m.group(1).split('.')[-1]  # e.g. "boolean", "Uri", "void"

        if ret_type_simple:
            method_re = re.compile(
                r'(?<![\w$])' + re.escape(ret_type_simple) + r'\s+' +
                re.escape(method_name) + r'\s*\('
            )
        else:
            method_re = re.compile(
                r'(?<![\w$])' + re.escape(method_name) + r'\s*\('
            )

        for snippet in java_snippets:
            fq_match = (
                block['fqClassName'] == snippet['fqClass'] or
                snippet['fqClass'].endswith(block['simpleClassName'])
            )
            if not fq_match:
                continue

            if any(method_re.search(l) for l in snippet['lines']):
                block['javaSource'] = '\n'.join(snippet['lines'])
                break


# ---------------------------------------------------------------------------
# Call stack parser
# ---------------------------------------------------------------------------

_CALL_STACK_SIG_RE = re.compile(r'^<[^>]+:\s*\S+\s+\w[\w$]*\s*\([^)]*\)>')

def _parse_call_stack(call_stack_text: str) -> list[dict]:
    result = []
    for line in call_stack_text.split('\n'):
        line = line.strip()
        if not _CALL_STACK_SIG_RE.match(line):
            continue
        info = _parse_sig(line)
        if info:
            result.append({
                'fqClassName':   info['fqClassName'],
                'simpleClassName': info['simpleClassName'],
                'methodName':    info['methodName'],
                'methodSig':     line,
            })
    return result


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def parse_appshark_detail(html: str) -> dict:
    """
    Parse an Appshark vulnerability detail HTML file.

    Returns structured JSON alongside passive, attribute-free report markup.
    No executable elements or scanner-supplied attributes reach the renderer.

    Shape:
      {
        "content":   str,          # sanitized passive report markup
        "callStack": [...],
        "blocks":    [...]
      }
    """
    plain    = _strip_html(html)
    sections = _extract_sections(plain)

    call_stack = _parse_call_stack(sections.get('call stack', ''))

    # Extract per-method Jimple + Java source directly from HTML structure.
    # This correctly handles the interleaved "java source code:" labels that
    # appear after each method block — plain-text section splitting truncates
    # the code detail at the first such label and loses all subsequent blocks.
    raw_blocks = _extract_raw_blocks_from_html(html)
    blocks     = _parse_code_detail(raw_blocks)

    # Java source is now attached per-block by the HTML extractor.
    # Fall back to the old section-based attach only if the HTML extractor
    # found nothing (e.g. for an unexpected HTML layout).
    if not any(b['javaSource'] for b in blocks):
        java_text = sections.get('java source code', '')
        if java_text:
            _attach_java_source(blocks, java_text)

    return {
        'content':   sanitize_report_html(html),
        'callStack': call_stack,
        'blocks':    blocks,
    }
