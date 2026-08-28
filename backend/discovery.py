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
