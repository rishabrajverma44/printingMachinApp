import { execSync } from "child_process";
import net from "net";
import os from "os";
import bonjour from "bonjour";

//List OS-installed printers (cross-platform)
export function listInstalledPrinters() {
  try {
    let result = "";
    if (os.platform() === "win32") {
      // Windows
      result = execSync("wmic printer get name").toString();
      return result
        .split("\n")
        .slice(1)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((name) => ({ type: "OS", name }));
    } else {
      // macOS / Linux
      result = execSync("lpstat -p").toString();
      return result
        .split("\n")
        .filter((line) => line.startsWith("printer "))
        .map((line) => line.split(" ")[1])
        .filter(Boolean)
        .map((name) => ({ type: "OS", name }));
    }
  } catch (err) {
    console.error("Error listing OS printers:", err);
    return [];
  }
}

//Discover LAN printers (ports 9100, 631, 515)
export async function discoverLanPrinters(subnet = "192.168.1.") {
  const activePrinters = [];

  const checkPort = (ip, port) =>
    new Promise((resolve) => {
      const socket = net.connect({ host: ip, port, timeout: 500 }, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("error", () => resolve(false));
      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });
    });

  const promises = [];
  for (let i = 1; i <= 254; i++) {
    const ip = subnet + i;
    [9100, 631, 515].forEach((port) => {
      promises.push(
        checkPort(ip, port).then((open) => {
          if (open) {
            activePrinters.push({
              type: "LAN",
              name: `LAN Printer ${ip}:${port}`,
              url: `ipp://${ip}:${port}`,
            });
          }
        })
      );
    });
  }

  await Promise.all(promises);
  return activePrinters;
}

// Discover Bonjour / mDNS printers (AirPrint, IPP)
export function discoverBonjourPrinters(timeout = 3000) {
  return new Promise((resolve) => {
    const found = [];
    const b = bonjour();
    const services = ["ipp", "ipps", "printer", "pdl-datastream"];

    services.forEach((svc) => {
      b.find({ type: svc }, (service) => {
        found.push({
          type: "IPP",
          name: service.name,
          url: `ipp://${service.referer.address}:${service.port}`,
        });
      });
    });

    setTimeout(() => {
      b.destroy();
      resolve(found);
    }, timeout);
  });
}

// Unified printer discovery
export async function discoverAllPrinters() {
  const installed = listInstalledPrinters();
  const lan = await discoverLanPrinters();
  const bonjourPrinters = await discoverBonjourPrinters();

  // return a single array of all printers
  return [...installed, ...lan, ...bonjourPrinters];
}
