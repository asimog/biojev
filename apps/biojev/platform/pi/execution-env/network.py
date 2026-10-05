"""Select the network's owning user namespace, then exec upstream Slirp.

Bubblewrap's --disable-userns creates a nested user namespace. Entering the
process's final user namespace cannot grant authority over its parent-owned netns.
Effect/Node have no portable NS_GET_USERNS ioctl; this fixed platform shim does.
"""

import fcntl
import os
import sys

binary, pid = sys.argv[1], str(int(sys.argv[2]))
with open(f"/proc/{pid}/ns/net", "rb") as network:
    owner = fcntl.ioctl(network.fileno(), 0xB701)  # linux/nsfs.h: NS_GET_USERNS
os.set_inheritable(owner, True)
os.execv(binary, [
    binary, f"--userns-path=/proc/self/fd/{owner}", "--configure",
    "--disable-host-loopback", "--ready-fd=1", pid, "tap0",
])
