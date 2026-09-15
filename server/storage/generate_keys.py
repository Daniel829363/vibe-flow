import sys
import subprocess

try:
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "cryptography"])
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization

from pathlib import Path

storage = Path(__file__).resolve().parent

# Merchant keys
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
priv_pem = key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
)
pub_pem = key.public_key().public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo
)

# Provider key (for webhook mock verification)
provider_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
provider_pub_pem = provider_key.public_key().public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo
)

(storage / 'finik_private.pem').write_bytes(priv_pem)
(storage / 'finik_public.pem').write_bytes(pub_pem)
(storage / 'finik_provider_public.pem').write_bytes(provider_pub_pem)

print('Keys generated successfully in', storage)
