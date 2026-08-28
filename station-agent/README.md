# Captain 97 station agent

This outbound-only Windows agent reads the Nautel VS300 on the transmitter LAN and posts a normalized snapshot to the private Captain 97 monitoring ingest route every 10 seconds.

## Safety boundary

- SNMP v2c `GET` requests only; the program contains no SNMP `SET` encoder.
- Exact Nautel VS 5.2 read channels only: RF state, forward power, reflected power, and peak FM modulation.
- Optional RDS reads use only the documented `PS?` and `TEXT?` commands on TCP 7005.
- No transmitter or AUI port is exposed to the internet. The only internet connection is outbound HTTPS to `www.captain97.com`.
- The Nautel write community is neither requested nor stored.

The OIDs come from Nautel's `NAUTEL-VS_SW_5.2-MIB.txt` for the installed VS software 5.2.1.6. Nautel represents power and modulation values as integer thousandths; the agent converts them to watts and percent before upload.

## Install on the transmitter-site Windows PC

1. Install Node.js 22 LTS if `node --version` is unavailable.
2. Download this folder to the transmitter-site PC.
3. Open Windows PowerShell as Administrator.
4. Run `Set-ExecutionPolicy -Scope Process Bypass`, then `./install.ps1`.
5. Paste the dedicated Nautel Read Community and the separate `MONITORING_INGEST_TOKEN` when prompted.

The installer tests SNMP before creating the startup task. If the test fails, it does not install the task. It stores configuration under `C:\ProgramData\Captain97\StationAgent`, restricts that directory to SYSTEM and local administrators, and registers `Captain 97 Station Agent` in Windows Task Scheduler.

## Uninstall

Run `./uninstall.ps1` as Administrator to remove the task and program while retaining local configuration and logs. Run `./uninstall.ps1 -RemoveConfiguration` to also delete the local credentials and logs.
