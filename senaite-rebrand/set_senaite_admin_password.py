"""
Set/reset the SENAITE 'admin' user's password directly via the ZODB user
manager API (Products.PluggableAuthService ZODBUserManager). This is the
correct way to change it — SENAITE has no SQL table for credentials, so a
raw-DB edit isn't possible; it must go through this API to keep the
internal login/userid indexes consistent.

USAGE (run on the server, from the project root that has docker-compose.yml):

  1. Edit NEW_PASSWORD below, or export SENAITE_NEW_PASSWORD before running.
  2. Stop the running senaite service so the ZODB file lock is free:
       docker compose stop senaite
  3. Copy this script into the persistent /data volume (NOT the container's
     ephemeral filesystem — /data is the only path shared between the
     stopped service container and the one-off `run` container):
       docker cp senaite-rebrand/set_senaite_admin_password.py xellabs-lims-senaite-1:/data/set_senaite_admin_password.py
  4. Run it via bin/instance run (this is Zope's supported way to execute
     a script with full application access — same idea as `manage.py shell`):
       docker compose run --rm senaite run /data/set_senaite_admin_password.py
  5. Restart the service:
       docker compose up -d senaite
  6. Clean up the temp file:
       docker exec xellabs-lims-senaite-1 rm -f /data/set_senaite_admin_password.py
  7. Verify:
       curl -s -o /dev/null -w "%{http_code}\n" -u "admin:<NEW_PASSWORD>" http://127.0.0.1:8080/senaite/@@overview-controlpanel
     (200 = success, 302 = auth failed)

NOTE: docker-compose.yml's senaite service must set the `PASSWORD` env var
(not ADMIN_PASSWORD/ADMIN_USER — those are silently ignored by the SENAITE
image's docker-initialize.py) for this password to also be picked up
correctly on a fresh/first-ever bootstrap of a new environment. This has
already been fixed in docker-compose.yml — SENAITE_ADMIN_PASSWORD in .env
now flows through correctly. This script is only needed to update the
password on an EXISTING install where the account already exists.
"""
import os
import transaction

NEW_PASSWORD = os.environ.get("SENAITE_NEW_PASSWORD", "")
if not NEW_PASSWORD:
    raise SystemExit("Set SENAITE_NEW_PASSWORD before running — no default password is shipped in the repo.")
ADMIN_USER_ID = "admin"

uf = app.acl_users.users.users

print("Before: logins=%s" % dict(uf._login_to_userid))

# Ensure login name matches the user_id (in case a previous bad run
# renamed it — updateUser(user_id, login_name) only renames the login).
uf.updateUser(ADMIN_USER_ID, ADMIN_USER_ID)

# Set the actual password (separate call — updateUser does NOT touch it).
uf.updateUserPassword(ADMIN_USER_ID, NEW_PASSWORD)

transaction.commit()

print("After: logins=%s" % dict(uf._login_to_userid))
print("Done. Verify with: curl -u admin:%s http://127.0.0.1:8080/senaite/@@overview-controlpanel" % NEW_PASSWORD)
