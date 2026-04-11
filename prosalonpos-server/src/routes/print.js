/**
 * ProSalonPOS — Print Routes
 * Sends ESC/POS data to network receipt printers via raw TCP.
 *
 * POST /print       — Send raw ESC/POS data to a printer IP
 * POST /print/test  — Send a test page to verify connectivity
 *
 * The browser sends the ESC/POS bytes (as a base64 string) and the printer IP.
 * This route opens a TCP connection to the printer and delivers the data.
 * Works for Epson, Star, and any ESC/POS-compatible thermal printer on port 9100.
 */
import { Router } from 'express';
import net from 'net';
import os from 'os';
import fs from 'fs';
import { exec } from 'child_process';

var router = Router();
var DEFAULT_PORT = 9100; // Standard raw print port for thermal printers
var CONNECT_TIMEOUT = 5000; // 5 seconds to connect
var SEND_TIMEOUT = 10000; // 10 seconds to send data

/**
 * Send raw data to a local port (COM3, ESDPRT001, /dev/usb/lp0, etc).
 * Works on Windows and Linux for USB-connected receipt printers.
 */
function sendToLocalPort(portName, dataBuffer) {
  return new Promise(function(resolve, reject) {
    var isWindows = os.platform() === 'win32';
    // Write data to a temp file, then copy to the port
    var tmpFile = os.tmpdir() + '/prosalonpos_print_' + Date.now() + '.bin';
    fs.writeFile(tmpFile, dataBuffer, function(err) {
      if (err) { reject(new Error('Failed to write temp print file: ' + err.message)); return; }
      var cmd;
      if (isWindows) {
        // Windows: copy /b to the port device
        var winPort = portName;
        // COM ports need \\.\COM3 format for port numbers > 9, but works for all
        if (/^COM\d+$/i.test(winPort)) winPort = '\\\\.\\' + winPort;
        cmd = 'copy /b "' + tmpFile.replace(/\//g, '\\') + '" "' + winPort + '"';
      } else {
        // Linux/Mac: write to device file
        cmd = 'cat "' + tmpFile + '" > "' + portName + '"';
      }
      exec(cmd, { timeout: 10000 }, function(execErr, stdout, stderr) {
        // Clean up temp file
        fs.unlink(tmpFile, function() {});
        if (execErr) {
          var msg = 'Failed to send to ' + portName;
          if (execErr.message && execErr.message.indexOf('Access is denied') !== -1) {
            msg += ' — another program may be using the printer. Close other POS software and try again.';
          }
          reject(new Error(msg));
        } else {
          resolve();
        }
      });
    });
  });
}

/**
 * Send raw data to a printer IP via TCP.
 * Returns a promise that resolves on success, rejects on error.
 */
function sendToPrinter(ip, port, dataBuffer) {
  return new Promise(function(resolve, reject) {
    var socket = new net.Socket();
    var resolved = false;

    function done(err) {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      if (err) reject(err);
      else resolve();
    }

    socket.setTimeout(CONNECT_TIMEOUT);

    socket.on('timeout', function() {
      done(new Error('Connection timed out — printer may be off or unreachable'));
    });

    socket.on('error', function(err) {
      var msg = 'Printer connection failed';
      if (err.code === 'ECONNREFUSED') msg = 'Printer refused connection — check IP address and make sure printer is on';
      else if (err.code === 'EHOSTUNREACH') msg = 'Printer unreachable — check network connection';
      else if (err.code === 'ETIMEDOUT') msg = 'Connection timed out — printer may be off or on a different network';
      done(new Error(msg));
    });

    socket.connect(port, ip, function() {
      // Connected — now send the data
      socket.setTimeout(SEND_TIMEOUT);
      socket.write(dataBuffer, function() {
        // Small delay to let printer process before closing
        setTimeout(function() { done(null); }, 200);
      });
    });
  });
}

// ── POST /print — Send ESC/POS data to printer (IP or local port) ──
router.post('/', async function(req, res, next) {
  try {
    var ip = req.body.ip;
    var portName = req.body.port_name; // COM3, ESDPRT001, etc.
    var data = req.body.data; // base64-encoded ESC/POS data
    if (!data) return res.status(400).json({ error: 'Print data is required' });
    var buffer = Buffer.from(data, 'base64');

    // Local port printing (USB via COM/ESDPRT)
    if (portName) {
      // Validate port name — only allow safe characters
      if (!/^[A-Za-z0-9_\-\\\/\.:]+$/.test(portName)) return res.status(400).json({ error: 'Invalid port name' });
      console.log('[Print] Sending', buffer.length, 'bytes to local port', portName);
      await sendToLocalPort(portName, buffer);
      console.log('[Print] Success → local port', portName);
      return res.json({ success: true, method: 'local_port', port_name: portName });
    }

    // Network IP printing
    if (!ip) return res.status(400).json({ error: 'Printer IP or port name is required' });
    var port = req.body.port || DEFAULT_PORT;
    var ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipPattern.test(ip)) return res.status(400).json({ error: 'Invalid IP address format' });
    console.log('[Print] Sending', buffer.length, 'bytes to', ip + ':' + port);
    await sendToPrinter(ip, port, buffer);
    console.log('[Print] Success →', ip);
    res.json({ success: true, method: 'ip_direct', ip: ip });
  } catch (err) {
    console.error('[Print] Failed →', err.message);
    res.status(502).json({ error: err.message, success: false });
  }
});

// ── POST /print/test — Test printer connectivity ──
router.post('/test', async function(req, res, next) {
  try {
    var ip = req.body.ip;
    var portName = req.body.port_name;
    var port = req.body.port || DEFAULT_PORT;

    if (!ip && !portName) return res.status(400).json({ error: 'Printer IP or port name is required' });

    // Build a simple test receipt
    var ESC = '\x1B';
    var GS = '\x1D';
    var testData = '';
    testData += ESC + '@'; // Init
    testData += ESC + 'a' + '\x01'; // Center
    testData += GS + '!' + '\x11'; // Double size
    testData += 'ProSalonPOS\n';
    testData += GS + '!' + '\x00'; // Normal size
    testData += ESC + 'E' + '\x01'; // Bold on
    testData += 'Printer Test\n';
    testData += ESC + 'E' + '\x00'; // Bold off
    testData += '-------------------------------\n';
    testData += 'If you can read this,\n';
    testData += 'your printer is working!\n';
    testData += '-------------------------------\n';
    testData += new Date().toLocaleString() + '\n';
    testData += '\n\n';
    testData += ESC + 'd' + '\x03'; // Feed
    testData += GS + 'V' + '\x41' + '\x03'; // Cut
    var buffer = Buffer.from(testData, 'binary');

    if (portName) {
      console.log('[Print] Test page → local port', portName);
      await sendToLocalPort(portName, buffer);
      console.log('[Print] Test success → local port', portName);
      return res.json({ success: true, port_name: portName, message: 'Test page sent — check your printer' });
    }

    console.log('[Print] Test page →', ip + ':' + port);
    await sendToPrinter(ip, port, buffer);
    console.log('[Print] Test success →', ip);
    res.json({ success: true, ip: ip, message: 'Test page sent — check your printer' });
  } catch (err) {
    console.error('[Print] Test failed →', err.message);
    res.status(502).json({ error: err.message, success: false });
  }
});

// ── POST /print/drawer — Open cash drawer ──
router.post('/drawer', async function(req, res, next) {
  try {
    var ip = req.body.ip;
    var portName = req.body.port_name;
    var port = req.body.port || DEFAULT_PORT;
    if (!ip && !portName) return res.status(400).json({ error: 'Printer IP or port name is required' });
    var ESC = '\x1B';
    var drawerCmd = ESC + 'p' + '\x00' + '\x19' + '\xFA';
    var buffer = Buffer.from(drawerCmd, 'binary');
    if (portName) {
      console.log('[Print] Cash drawer kick → local port', portName);
      await sendToLocalPort(portName, buffer);
      return res.json({ success: true, port_name: portName });
    }
    console.log('[Print] Cash drawer kick →', ip + ':' + port);
    await sendToPrinter(ip, port, buffer);
    res.json({ success: true, ip: ip });
  } catch (err) {
    console.error('[Print] Drawer kick failed →', err.message);
    res.status(502).json({ error: err.message, success: false });
  }
});

// ═══════════════════════════════════════════════════
// Printer auto-detect scan
// ═══════════════════════════════════════════════════

// MAC address prefix → brand lookup (common receipt printer manufacturers)
var MAC_VENDORS = {
  '00:26:AB': 'Epson', '00:1B:35': 'Epson', 'AC:18:26': 'Epson', '64:EB:8C': 'Epson',
  'E0:4F:43': 'Epson', 'BC:5C:4C': 'Epson', 'F4:4D:30': 'Epson', '44:D2:44': 'Epson',
  '58:76:75': 'Epson', 'D8:49:2F': 'Epson', 'A4:5D:36': 'Epson', '00:25:E7': 'Epson',
  '00:00:48': 'Epson',
  '00:11:62': 'Star Micronics', '00:80:87': 'Star Micronics',
  '28:E3:1F': 'Star Micronics', 'F4:F5:24': 'Star Micronics',
  '8C:1F:64': 'Citizen',
  '00:0E:9E': 'Bixolon', 'B8:AC:6F': 'Bixolon',
  '00:16:D4': 'Zebra', '9C:D9:17': 'Zebra',
  '00:17:44': 'Hewlett-Packard', '00:1A:4B': 'Hewlett-Packard',
  '3C:2A:F4': 'Brother', '00:80:77': 'Brother',
};

/**
 * Try connecting to an IP on port 9100 with a short timeout.
 * Returns true if something is listening (likely a printer).
 */
function probePort(ip, port, timeoutMs) {
  return new Promise(function(resolve) {
    var socket = new net.Socket();
    var done = false;
    function finish(result) {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    }
    socket.setTimeout(timeoutMs);
    socket.on('connect', function() { finish(true); });
    socket.on('timeout', function() { finish(false); });
    socket.on('error', function() { finish(false); });
    socket.connect(port, ip);
  });
}

/**
 * Read ARP table and return a map of IP → MAC address.
 * Works on Linux (Railway, salon PCs running Linux) and macOS.
 */
async function getArpTable() {
  var { exec } = await import('child_process');
  return new Promise(function(resolve) {
    exec('arp -a', { timeout: 5000 }, function(err, stdout) {
      var table = {};
      if (err || !stdout) { resolve(table); return; }
      // Parse arp -a output: varies by OS
      // Linux: hostname (IP) at MAC [ether] on iface
      // macOS: hostname (IP) at MAC on iface
      var lines = stdout.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var ipMatch = line.match(/\((\d+\.\d+\.\d+\.\d+)\)/);
        var macMatch = line.match(/([0-9a-fA-F]{1,2}[:-]){5}[0-9a-fA-F]{1,2}/);
        if (ipMatch && macMatch) {
          // Normalize MAC to XX:XX:XX:XX:XX:XX format
          var mac = macMatch[0].toUpperCase().replace(/-/g, ':');
          // Pad single-digit hex pairs (e.g. 0:26:ab → 00:26:AB)
          mac = mac.split(':').map(function(p) { return p.length === 1 ? '0' + p : p; }).join(':');
          table[ipMatch[1]] = mac;
        }
      }
      resolve(table);
    });
  });
}

/**
 * Look up brand from MAC address prefix (first 3 octets).
 */
function lookupBrand(mac) {
  if (!mac) return 'Unknown';
  var prefix = mac.split(':').slice(0, 3).join(':');
  return MAC_VENDORS[prefix] || 'Unknown';
}

/**
 * Get the server's local IP and subnet.
 */
function getLocalSubnet() {
  try {
    var interfaces = os.networkInterfaces();
    for (var name in interfaces) {
      var addrs = interfaces[name];
      for (var j = 0; j < addrs.length; j++) {
        var addr = addrs[j];
        if (addr.family === 'IPv4' && !addr.internal) {
          var parts = addr.address.split('.');
          return parts[0] + '.' + parts[1] + '.' + parts[2];
        }
      }
    }
  } catch (e) {}
  return null;
}

// ── POST /print/scan — Scan network for printers ──
router.post('/scan', async function(req, res) {
  try {
    // Browser sends the subnet to scan (e.g. "192.168.1")
    var subnet = req.body.subnet || getLocalSubnet();
    if (!subnet) {
      return res.json({ success: true, printers: [], message: 'No subnet provided — try adding printer by IP manually' });
    }

    // Validate subnet format
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(subnet)) {
      return res.status(400).json({ error: 'Invalid subnet format. Use format like 192.168.1', success: false });
    }

    console.log('[Print] Scanning subnet', subnet + '.x for printers on port 9100...');

    // Probe all 254 IPs on port 9100 in parallel (1.5s timeout each)
    var probes = [];
    for (var i = 1; i <= 254; i++) {
      var ip = subnet + '.' + i;
      probes.push({ ip: ip, promise: probePort(ip, 9100, 1500) });
    }

    // Wait for all probes
    var results = await Promise.all(probes.map(function(p) {
      return p.promise.then(function(open) { return { ip: p.ip, open: open }; });
    }));

    // Filter to only IPs with port 9100 open
    var printerIps = results.filter(function(r) { return r.open; }).map(function(r) { return r.ip; });
    console.log('[Print] Found', printerIps.length, 'device(s) with port 9100 open');

    if (printerIps.length === 0) {
      return res.json({ success: true, printers: [], message: 'No printers found on the network. Make sure your printer is on and connected.' });
    }

    // Get ARP table for MAC addresses
    var arpTable = await getArpTable();

    // Build printer info
    var printers = printerIps.map(function(ip) {
      var mac = arpTable[ip] || null;
      var brand = lookupBrand(mac);
      return {
        ip: ip,
        mac: mac,
        brand: brand,
        model: null, // SNMP query could fill this in future
      };
    });

    console.log('[Print] Scan complete:', JSON.stringify(printers));
    res.json({ success: true, printers: printers });
  } catch (err) {
    console.error('[Print] Scan error:', err.message);
    res.status(500).json({ error: 'Scan failed: ' + err.message, success: false });
  }
});

export default router;
