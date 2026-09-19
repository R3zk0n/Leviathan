"""iOS crypto analysis helpers.

Keep this module framework-agnostic: it should not depend on Flask/RESTX.
It’s a small library used by API endpoints (e.g., `project/api/iOS/ios.py`).

Contract:
- Input: a Strongarm Mach-O analyzer instance (typically `strongarm.macho.MachoAnalyzer`).
- Output: a list of call-site objects that are JSON-serializable.

Design goals:
- No side effects (no prints, no globals mutated).
- Stable return shape for the frontend.
- Easy to extend with additional crypto primitives.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Sequence


# ---- ARM64 calling convention signatures (register -> meaning) ----

# Signatures are based on the ARM64 ABI which uses the X registers for the first 8 arguments (x0-x7).
# The mapping of these registers to the function parameters is based on the standard calling convention for ARM64.
CCCRYPT_SIGNATURE: Dict[str, str] = {
    "x0": "CCOperation op",
    "x1": "CCAlgorithm alg",
    "x2": "CCOptions options",
    "x3": "const void *key",
    "x4": "size_t keyLength",
    "x5": "const void *iv",
    "x6": "const void *dataIn",
    "x7": "size_t dataInLength",
}

CCHmac_SIGNATURE: Dict[str, str] = {
    "x0": "CCHmacAlgorithm alg",
    "x1": "const void *key",
    "x2": "size_t keyLength",
    "x3": "const void *dataIn",
    "x4": "size_t dataInLength",
    "x5": "void *macOut",
}

CCKeyDerivationPBKDF_SIGNATURE: Dict[str, str] = {
    "x0": "CCPBKDFAlgorithm algorithm",
    "x1": "char const* password",
    "x2": "uint64_t passwordLen",
    "x3": "uint8_t* salt",
    "x4": "uint64_t saltLen",
    "x5": "CCPseudoRandomAlgorithm prf",
    "x6": "uint32_t rounds",
    "x7": "uint8_t* derivedKey",
    "x8": "uint64_t derivedKeyLen",
}


@dataclass(frozen=True)
class SymbolCall:
    """Single call-site into a symbol."""

    caller_addr: Optional[str]
    caller_func_start_address: Optional[str]
    destination_addr: Optional[str]


def _to_hex(addr: Any) -> Optional[str]:
    if addr is None:
        return None
    try:
        return hex(int(addr))
    except Exception:
        return None


def find_symbol_calls(analyzer: Any, symbol_name: str) -> List[Dict[str, Optional[str]]]:
    """Return call-sites to `symbol_name` as a JSON-serializable list.

    `analyzer` is expected to expose:
      - callable_symbol_for_symbol_name(name) -> symbol (with .address)
      - calls_to(address) -> iterable of call objects (with caller_addr/destination_addr)
    """

    calls_out: List[Dict[str, Optional[str]]] = []

    symbol = analyzer.callable_symbol_for_symbol_name(symbol_name)
    if not symbol:
        return calls_out

    for call in analyzer.calls_to(symbol.address) or []:
        calls_out.append(
            asdict(
                SymbolCall(
                    caller_addr=_to_hex(getattr(call, "caller_addr", None)),
                    caller_func_start_address=_to_hex(getattr(call, "caller_func_start_address", None)),
                    destination_addr=_to_hex(getattr(call, "destination_addr", None)),
                )
            )
        )

    return calls_out


def find_cchmac_calls(analyzer: Any) -> List[Dict[str, Optional[str]]]:
    # Strongarm typically uses the plain symbol name for CCHmac
    return find_symbol_calls(analyzer, "CCHmac")


def find_cccrypt_calls(analyzer: Any) -> List[Dict[str, Optional[str]]]:
    # CCCrypt is usually exported as _CCCrypt
    return find_symbol_calls(analyzer, "_CCCrypt")


__all__ = [
    "CCCRYPT_SIGNATURE",
    "CCHmac_SIGNATURE",
    "CCKeyDerivationPBKDF_SIGNATURE",
    "find_symbol_calls",
    "find_cchmac_calls",
    "find_cccrypt_calls",
]
