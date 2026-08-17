"""Configuration for the N.E.X.U.S. CLI client."""

import os

# API base URL — change this if running on a different host/port
API_URL = os.environ.get("NEXUS_API_URL", "http://127.0.0.1:9500")
