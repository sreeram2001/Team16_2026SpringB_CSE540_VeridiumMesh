"""
blockchain/wallet.py
Provides ECDSA key-pair generation, transaction signing, and signature verification.
Uses the NIST P-256 (secp256r1) curve via the 'ecdsa' library.
"""

import hashlib
import json

from ecdsa import SigningKey, VerifyingKey, NIST256p, BadSignatureError


def generate_keypair() -> dict:
    """
    Generate a new ECDSA private/public key pair.

    Returns:
        {
            "private_key": "<hex string>",   # keep this SECRET
            "public_key":  "<hex string>",   # share this as your wallet address
        }
    """
    sk = SigningKey.generate(curve=NIST256p)
    vk = sk.get_verifying_key()
    return {
        "private_key": sk.to_string().hex(),
        "public_key":  vk.to_string().hex(),
    }


def sign_transaction(tx: dict, private_key_hex: str) -> str:
    """
    Sign a transaction dict with the given private key.

    The signature covers a canonical JSON dump of the transaction
    (sorted keys, no whitespace) so it is deterministic.

    Returns: hex-encoded signature string.
    """
    sk      = SigningKey.from_string(bytes.fromhex(private_key_hex), curve=NIST256p)
    tx_bytes = json.dumps(tx, sort_keys=True, separators=(",", ":")).encode()
    digest   = hashlib.sha256(tx_bytes).digest()
    return sk.sign_digest(digest).hex()


def verify_signature(tx: dict, signature_hex: str, public_key_hex: str) -> bool:
    """
    Verify that `signature_hex` was produced by the private key matching
    `public_key_hex` over the canonical JSON of `tx`.

    Returns True if valid, False otherwise.
    """
    try:
        vk      = VerifyingKey.from_string(bytes.fromhex(public_key_hex), curve=NIST256p)
        tx_bytes = json.dumps(tx, sort_keys=True, separators=(",", ":")).encode()
        digest   = hashlib.sha256(tx_bytes).digest()
        return vk.verify_digest(bytes.fromhex(signature_hex), digest)
    except (BadSignatureError, Exception):
        return False
