"""mDNS / Zeroconf — announce this device on the LAN."""
import socket
from config import HTTP_PORT

_zeroconf = None
_service_info = None


def _local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def _is_ts(ip):
    try:
        o = ip.split(".")
        return len(o) == 4 and o[0] == "100" and 64 <= int(o[1]) <= 127
    except Exception:
        return False


def _ts_cli():
    """Ask the Tailscale CLI directly — most reliable on Windows/macOS/Linux."""
    import subprocess, os, shutil
    exes = ["tailscale"]
    if os.name == "nt":
        exes += [
            r"C:\Program Files\Tailscale\tailscale.exe",
            r"C:\Program Files (x86)\Tailscale\tailscale.exe",
        ]
    for exe in exes:
        path = exe if os.path.sep in exe else shutil.which(exe)
        if not path:
            continue
        try:
            flags = 0x08000000 if os.name == "nt" else 0  # CREATE_NO_WINDOW
            out = subprocess.run([path, "ip", "-4"], capture_output=True, text=True,
                                 timeout=4, creationflags=flags)
            for line in (out.stdout or "").splitlines():
                ip = line.strip()
                if _is_ts(ip):
                    return ip
        except Exception:
            continue
    return None


def _tailscale_ip():
    """Find this device's Tailscale address (CGNAT range 100.64.0.0/10), if any."""
    # 1) ask Tailscale itself — the definitive source
    ip = _ts_cli()
    if ip:
        return ip
    # 2) enumerate local interfaces
    candidates = []
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            candidates.append(info[4][0])
    except Exception:
        pass
    try:
        import psutil
        for addrs in psutil.net_if_addrs().values():
            for a in addrs:
                if getattr(a, "family", None) == socket.AF_INET:
                    candidates.append(a.address)
    except Exception:
        pass
    for ip in candidates:
        if _is_ts(ip):
            return ip
    return None


def start_mdns():
    global _zeroconf, _service_info
    try:
        from zeroconf import Zeroconf, ServiceInfo
        ip = _local_ip()
        hostname = socket.gethostname()
        _service_info = ServiceInfo(
            "_thingtracker._tcp.local.",
            f"ThingTracker@{hostname}._thingtracker._tcp.local.",
            addresses=[socket.inet_aton(ip)],
            port=HTTP_PORT,
            properties={"device": hostname, "app": "ThingTracker"},
        )
        _zeroconf = Zeroconf()
        _zeroconf.register_service(_service_info)
        print(f"[mDNS] Announced ThingTracker on {ip}:{HTTP_PORT} as '{hostname}'")
    except Exception as e:
        print(f"[mDNS] Could not start discovery: {e}")
