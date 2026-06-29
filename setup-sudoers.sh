#!/bin/bash
# ============================================================
# Run this ONCE in your WSL terminal to enable single-command startup:
#   bash /mnt/c/Users/Hilton/xellabs-lims/setup-sudoers.sh
#
# What it does: grants passwordless sudo for postgresql and
# redis-server service commands ONLY — nothing else.
# ============================================================
echo "hilton ALL=(ALL) NOPASSWD: /usr/sbin/service postgresql *, /usr/sbin/service redis-server *" \
  | sudo tee /etc/sudoers.d/xellabs-services > /dev/null
sudo chmod 440 /etc/sudoers.d/xellabs-services
echo ""
echo "Done! Test it:"
echo "  sudo -n service postgresql status"
echo "  sudo -n service redis-server status"
echo ""
echo "Now you can start everything with one command from PowerShell:"
echo "  .\start.ps1"
