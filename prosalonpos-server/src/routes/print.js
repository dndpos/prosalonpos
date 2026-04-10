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

var router = Router();
var DEFAULT_PORT = 9100; // Standard raw print port for thermal printers
var CONNECT_TIMEOUT = 5000; // 5 seconds to connect
var SEND_TIMEOUT = 10000; // 10 seconds to send data

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

// ── POST /print — Send ESC/POS data to printer ──
router.post('/', async function(req, res, next) {
  try {
    var ip = req.body.ip;
    var port = req.body.port || DEFAULT_PORT;
    var data = req.body.data; // base64-encoded ESC/POS data

    if (!ip) return res.status(400).json({ error: 'Printer IP address is required' });
    if (!data) return res.status(400).json({ error: 'Print data is required' });

    // Validate IP format (basic check)
    var ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipPattern.test(ip)) return res.status(400).json({ error: 'Invalid IP address format' });

    // Decode base64 to buffer
    var buffer = Buffer.from(data, 'base64');
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
    var port = req.body.port || DEFAULT_PORT;

    if (!ip) return res.status(400).json({ error: 'Printer IP address is required' });

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
    var port = req.body.port || DEFAULT_PORT;

    if (!ip) return res.status(400).json({ error: 'Printer IP address is required' });

    // Cash drawer kick command
    var ESC = '\x1B';
    var drawerCmd = ESC + 'p' + '\x00' + '\x19' + '\xFA';
    var buffer = Buffer.from(drawerCmd, 'binary');

    console.log('[Print] Cash drawer kick →', ip + ':' + port);
    await sendToPrinter(ip, port, buffer);

    res.json({ success: true, ip: ip });
  } catch (err) {
    console.error('[Print] Drawer kick failed →', err.message);
    res.status(502).json({ error: err.message, success: false });
  }
});

export default router;
