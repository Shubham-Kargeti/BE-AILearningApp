"""
Test script to verify Azure AD SSO configuration.

This script checks if all required Azure AD settings are configured.
Run this script to verify your Azure AD setup before testing SSO.
"""

import os
import re


def check_azure_config():
    """Check if Azure AD configuration is present in config.py."""
    print("=" * 60)
    print("Azure AD SSO Configuration Check")
    print("=" * 60)
    print()
    
    # Read config.py file
    config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config.py')
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config_content = f.read()
    except FileNotFoundError:
        print(f"❌ config.py not found at {config_path}")
        return False
    
    # Check for Azure AD settings
    required_settings = {
        "AZURE_CLIENT_ID": r'AZURE_CLIENT_ID:\s*str\s*=\s*["\'](.+?)["\']',
        "AZURE_CLIENT_SECRET": r'AZURE_CLIENT_SECRET:\s*str\s*=\s*["\'](.+?)["\']',
        "AZURE_TENANT_ID": r'AZURE_TENANT_ID:\s*str\s*=\s*["\'](.+?)["\']',
        "AZURE_REDIRECT_URI": r'AZURE_REDIRECT_URI:\s*str\s*=\s*["\'](.+?)["\']',
    }
    
    all_configured = True
    
    for setting_name, pattern in required_settings.items():
        match = re.search(pattern, config_content)
        
        if match:
            value = match.group(1)
            is_set = bool(value and value.strip())
            status = "✅ SET" if is_set else "❌ EMPTY"
            
            if is_set:
                # Show partial value for security
                if "SECRET" in setting_name:
                    display_value = f"{value[:8]}..." if len(value) > 8 else "***"
                else:
                    display_value = value
                print(f"{setting_name:25s}: {status:12s} ({display_value})")
            else:
                print(f"{setting_name:25s}: {status:12s} (not configured)")
                all_configured = False
        else:
            print(f"{setting_name:25s}: ❌ NOT FOUND in config.py")
            all_configured = False
    
    # Check environment variables as fallback
    print()
    print("Environment Variables:")
    print("-" * 60)
    
    env_vars = ["AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET", "AZURE_TENANT_ID"]
    has_env_vars = False
    
    for var in env_vars:
        value = os.environ.get(var, "")
        is_set = bool(value and value.strip())
        
        if is_set:
            has_env_vars = True
            if "SECRET" in var:
                display = f"{value[:8]}..."
            else:
                display = value
            print(f"{var:25s}: ✅ SET ({display})")
        else:
            print(f"{var:25s}: ❌ NOT SET")
    
    print()
    print("=" * 60)
    
    if all_configured or has_env_vars:
        print("✅ Azure AD settings are configured!")
        print()
        print("Next steps:")
        print("1. Ensure Azure AD app is registered in Azure Portal")
        print("2. Start the backend: uvicorn app.main:app --reload")
        print("3. Test SSO login: http://localhost:8000/api/v1/auth/sso/azure/login")
        print("4. Check API docs: http://localhost:8000/docs")
        return True
    else:
        print("❌ Azure AD settings are not fully configured!")
        print()
        print("To configure:")
        print("1. Register app in Azure Portal (see AZURE_AD_SSO_SETUP.md)")
        print("2. Update config.py with Azure credentials:")
        print("   AZURE_CLIENT_ID: str = 'your-client-id'")
        print("   AZURE_CLIENT_SECRET: str = 'your-client-secret'")
        print("   AZURE_TENANT_ID: str = 'your-tenant-id'")
        print()
        print("Or set environment variables:")
        print("   $env:AZURE_CLIENT_ID='your-client-id'")
        print("   $env:AZURE_CLIENT_SECRET='your-secret'")
        print("   $env:AZURE_TENANT_ID='your-tenant-id'")
        return False
    
    print("=" * 60)


def check_dependencies():
    """Check if required dependencies are installed."""
    print()
    print("Checking dependencies...")
    print("-" * 60)
    
    dependencies = {
        "authlib": "1.3.2",
        "httpx": "0.28.1",
    }
    
    all_installed = True
    
    for package, expected_version in dependencies.items():
        try:
            module = __import__(package)
            version = getattr(module, "__version__", "unknown")
            
            if version == expected_version or version.startswith(expected_version.split('.')[0]):
                print(f"✅ {package:15s} {version:10s} (expected {expected_version})")
            else:
                print(f"⚠️  {package:15s} {version:10s} (expected {expected_version})")
        except ImportError:
            print(f"❌ {package:15s} NOT INSTALLED")
            all_installed = False
    
    if not all_installed:
        print()
        print("To install missing dependencies:")
        print("pip install authlib==1.3.2 httpx==0.28.1")
    
    print("-" * 60)
    return all_installed


def check_auth_file():
    """Check if auth.py has SSO endpoints."""
    print()
    print("Checking auth.py for SSO endpoints...")
    print("-" * 60)
    
    auth_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), 
        'app', 'api', 'auth.py'
    )
    
    try:
        with open(auth_path, 'r', encoding='utf-8') as f:
            auth_content = f.read()
    except FileNotFoundError:
        print(f"❌ auth.py not found at {auth_path}")
        return False
    
    # Check for SSO endpoints
    has_login = 'def azure_sso_login' in auth_content
    has_callback = 'def azure_sso_callback' in auth_content
    has_oauth = 'from authlib' in auth_content
    
    print(f"SSO Login endpoint:    {'✅ FOUND' if has_login else '❌ NOT FOUND'}")
    print(f"SSO Callback endpoint: {'✅ FOUND' if has_callback else '❌ NOT FOUND'}")
    print(f"OAuth imports:         {'✅ FOUND' if has_oauth else '❌ NOT FOUND'}")
    
    print("-" * 60)
    return has_login and has_callback and has_oauth


def main():
    """Run all configuration checks."""
    print()
    
    # Check if auth.py has SSO endpoints
    auth_ok = check_auth_file()
    
    # Check dependencies
    deps_ok = check_dependencies()
    
    # Check Azure configuration
    config_ok = check_azure_config()
    
    # Final summary
    print()
    print("=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"SSO Endpoints: {'✅ OK' if auth_ok else '❌ MISSING'}")
    print(f"Dependencies:  {'✅ OK' if deps_ok else '❌ FAILED'}")
    print(f"Configuration: {'✅ OK' if config_ok else '❌ INCOMPLETE'}")
    print("=" * 60)
    print()
    
    if auth_ok and deps_ok and config_ok:
        print("🎉 Azure AD SSO is ready to use!")
        print()
        print("Start the backend:")
        print("  uvicorn app.main:app --reload")
        print()
        print("Test endpoints:")
        print("  SSO Login:  GET  http://localhost:8000/api/v1/auth/sso/azure/login")
        print("  API Docs:   GET  http://localhost:8000/docs")
    elif not config_ok:
        print("⚠️  Next step: Configure Azure AD credentials")
        print()
        print("See AZURE_AD_SSO_SETUP.md for detailed setup instructions")
    elif not deps_ok:
        print("⚠️  Next step: Install dependencies")
        print()
        print("Run: pip install authlib==1.3.2 httpx==0.28.1")
    else:
        print("⚠️  Azure AD SSO implementation incomplete")
        print()
        print("See AZURE_AD_SSO_SETUP.md for setup instructions")
    
    print()


if __name__ == "__main__":
    main()
