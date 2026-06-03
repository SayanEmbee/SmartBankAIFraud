import os
import requests
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

security = HTTPBearer()

# Environment profiles
REQUIRE_AUTH = os.environ.get("REQUIRE_AUTH", "false").lower() == "true"
ALLOWED_DOMAINS = [d.strip() for d in os.environ.get("ALLOWED_DOMAINS", "embee.co.in,yourorganization.com,bankcorp.com,gmail.com,outlook.com,hotmail.com,live.com").split(",") if d.strip()]
AZURE_CLIENT_ID = os.environ.get("AZURE_CLIENT_ID", "")
AZURE_TENANT_ID = os.environ.get("AZURE_TENANT_ID", "")

# Cached Microsoft public keys for verification
jwks_cache = None
jwks_expires = 0

def fetch_microsoft_jwks():
    """Retrieve public signing keys from Entra ID metadata endpoint."""
    global jwks_cache
    try:
        url = "https://login.microsoftonline.com/common/discovery/v2.0/keys"
        resp = requests.get(url, timeout=5.0)
        if resp.status_code == 200:
            jwks_cache = resp.json()
            return jwks_cache
    except Exception:
        pass
    return jwks_cache

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Validate bearer JWT access token, filtering emails by domain claims."""
    token = credentials.credentials
    
    # Dynamically fetch fresh environment variables to prevent load-time caching issues
    require_auth = os.environ.get("REQUIRE_AUTH", "false").lower() == "true"
    allowed_domains = [d.strip() for d in os.environ.get("ALLOWED_DOMAINS", "embee.co.in,yourorganization.com,bankcorp.com,gmail.com,outlook.com,hotmail.com,live.com").split(",") if d.strip()]
    azure_client_id = os.environ.get("AZURE_CLIENT_ID", "")
    azure_tenant_id = os.environ.get("AZURE_TENANT_ID", "")
    
    if not require_auth:
        # Mock Bypass Authentication Flow (Offline Test Mode)
        # Simply decode or mock parse the user info
        try:
            # Check for simulated mock tokens
            if token.startswith("MOCK_TOKEN_"):
                email = token.replace("MOCK_TOKEN_", "")
                domain = email.split("@")[-1] if "@" in email else ""
                
                if domain not in allowed_domains:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=f"Access Denied: Email domain @{domain} is not in approved organizational registry."
                    )
                return {"email": email, "name": email.split("@")[0].replace(".", " ").title(), "is_mock": True}
            raise JWTError("Invalid simulated token")
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Authentication Failed: {str(e)}"
            )

    # Production Microsoft Entra ID Authentication Flow
    global jwks_cache
    if not jwks_cache:
        fetch_microsoft_jwks()

    if not jwks_cache:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication Failed: Unable to fetch Microsoft public keys (Entra ID metadata endpoint unreachable)."
        )

    try:
        unverified_header = jwt.get_unverified_header(token)
        print(f"[AUTH DIAGNOSTIC] Incoming token header: {unverified_header}")
        kid = unverified_header.get("kid")
        
        rsa_key = {}
        for key in jwks_cache.get("keys", []):
            if key["kid"] == kid:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"]
                }
                break
                
        if rsa_key:
            print(f"[AUTH DIAGNOSTIC] Matching Microsoft public key found for kid: {kid}")
            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=["RS256"],
                audience=azure_client_id,
                options={"verify_issuer": False}
            )
            print(f"[AUTH DIAGNOSTIC] Decoded token payload claims: {list(payload.keys())}")
            
            # Dynamically verify issuer matches standard Microsoft Entra ID formats
            iss = payload.get("iss", "")
            if not (iss.startswith("https://login.microsoftonline.com/") and iss.endswith("/v2.0")):
                print(f"[AUTH DIAGNOSTIC] Issuer check failed for: {iss}")
                raise JWTError("Invalid token issuer registry origin.")
            
            # Extract email claims
            email = payload.get("preferred_username") or payload.get("email")
            if not email:
                print(f"[AUTH DIAGNOSTIC] Missing preferred_username or email claim in payload")
                raise JWTError("Missing organizational email identifier claim")
                
            domain = email.split("@")[-1]
            print(f"[AUTH DIAGNOSTIC] Decoded user email: {email} | Domain: {domain}")
            if domain not in allowed_domains:
                print(f"[AUTH DIAGNOSTIC] Domain check failed. Domain '{domain}' not in approved list: {allowed_domains}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Access Denied: Email domain @{domain} is not in approved organizational registry."
                )
                
            return {"email": email, "name": payload.get("name", ""), "is_mock": False}
            
        print(f"[AUTH DIAGNOSTIC] Public key matching kid '{kid}' was not found in Microsoft JWKS cache keys.")
        raise JWTError("Public key matching 'kid' not found.")
    except JWTError as e:
        print(f"[AUTH DIAGNOSTIC] JWTError encountered: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Signature Access Token: {str(e)}"
        )
    except Exception as e:
        print(f"[AUTH DIAGNOSTIC] General Exception encountered: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification error: {str(e)}"
        )
