const fs = require("node:fs");
const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "..");
const baileysRoot = path.join(
  workspaceRoot,
  "node_modules",
  "@whiskeysockets",
  "baileys",
);

const messagesRecvPath = path.join(
  baileysRoot,
  "lib",
  "Socket",
  "messages-recv.js",
);
const socketPath = path.join(
  baileysRoot,
  "lib",
  "Socket",
  "socket.js",
);

function replaceOnce(content, searchValue, replaceValue, label) {
  if (!content.includes(searchValue)) {
    throw new Error(`No se encontro el bloque esperado para ${label}`);
  }

  return content.replace(searchValue, replaceValue);
}

function patchMessagesRecv() {
  if (!fs.existsSync(messagesRecvPath)) {
    throw new Error(`No existe ${messagesRecvPath}`);
  }

  let content = fs.readFileSync(messagesRecvPath, "utf8");

  if (!content.includes("buildAckStanza(node, errorCode, authState.creds.me?.id)")) {
    content = replaceOnce(
      content,
      "buildAckStanza(node, errorCode, authState.creds.me.id)",
      "buildAckStanza(node, errorCode, authState.creds.me?.id)",
      "ack pre-login",
    );

    fs.writeFileSync(messagesRecvPath, content, "utf8");
  }
}

function patchSocket() {
  if (!fs.existsSync(socketPath)) {
    throw new Error(`No existe ${socketPath}`);
  }

  let content = fs.readFileSync(socketPath, "utf8");

  if (content.includes("CB:notification,type:companion_reg_refresh")) {
    return;
  }

  const originalBlock = `    // QR gen
    ws.on('CB:iq,type:set,pair-device', async (stanza) => {
        const iq = {
            tag: 'iq',
            attrs: {
                to: S_WHATSAPP_NET,
                type: 'result',
                id: stanza.attrs.id
            }
        };
        await sendNode(iq);
        const pairDeviceNode = getBinaryNodeChild(stanza, 'pair-device');
        const refNodes = getBinaryNodeChildren(pairDeviceNode, 'ref');
        const noiseKeyB64 = Buffer.from(creds.noiseKey.public).toString('base64');
        const identityKeyB64 = Buffer.from(creds.signedIdentityKey.public).toString('base64');
        const advB64 = creds.advSecretKey;
        let qrMs = qrTimeout || 60000; // time to let a QR live
        const genPairQR = () => {
            if (!ws.isOpen) {
                return;
            }
            const refNode = refNodes.shift();
            if (!refNode) {
                void end(new Boom('QR refs attempts ended', { statusCode: DisconnectReason.timedOut }));
                return;
            }
            const ref = refNode.content.toString('utf-8');
            const qr = buildPairingQRData(ref, noiseKeyB64, identityKeyB64, advB64, browser);
            ev.emit('connection.update', { qr });
            qrTimer = setTimeout(genPairQR, qrMs);
            qrMs = qrTimeout || 20000; // shorter subsequent qrs
        };
        genPairQR();
    });
    // device paired for the first time`;

  const patchedBlock = `    // Re-render the QR currently on screen. Set while a pairing QR flow is
    // live on this connection, undefined otherwise.
    let refreshPairingQR;
    // QR gen
    ws.on('CB:iq,type:set,pair-device', async (stanza) => {
        const iq = {
            tag: 'iq',
            attrs: {
                to: S_WHATSAPP_NET,
                type: 'result',
                id: stanza.attrs.id
            }
        };
        await sendNode(iq);
        const pairDeviceNode = getBinaryNodeChild(stanza, 'pair-device');
        const refNodes = getBinaryNodeChildren(pairDeviceNode, 'ref');
        const refs = refNodes.map((refNode) => refNode.content.toString('utf-8'));
        const noiseKeyB64 = Buffer.from(creds.noiseKey.public).toString('base64');
        const identityKeyB64 = Buffer.from(creds.signedIdentityKey.public).toString('base64');
        let currentRef;
        const renderPairingQR = (ref) => {
            const qr = buildPairingQRData(ref, noiseKeyB64, identityKeyB64, creds.advSecretKey, browser);
            ev.emit('connection.update', { qr });
        };
        const nextPairingQR = () => {
            const ref = refs.shift();
            if (!ref) {
                return false;
            }
            currentRef = ref;
            renderPairingQR(ref);
            return true;
        };
        refreshPairingQR = () => {
            if (!currentRef) {
                return false;
            }
            renderPairingQR(currentRef);
            return true;
        };
        let qrMs = qrTimeout || 60000; // time to let a QR live
        const genPairQR = () => {
            if (!ws.isOpen) {
                return;
            }
            if (!nextPairingQR()) {
                void end(new Boom('QR refs attempts ended', { statusCode: DisconnectReason.timedOut }));
                return;
            }
            qrTimer = setTimeout(genPairQR, qrMs);
            qrMs = qrTimeout || 20000; // shorter subsequent qrs
        };
        genPairQR();
    });
    ws.on('CB:notification,type:companion_reg_refresh', (node) => {
        const hasExpectedChild = Boolean(getBinaryNodeChild(node, 'companion_reg_refresh') || getBinaryNodeChild(node, 'pair-device-rotate-qr'));
        if (!hasExpectedChild) {
            logger.warn({ node }, 'companion_reg_refresh carries neither expected child; ignoring');
            return;
        }
        if (creds.me) {
            logger.debug('companion_reg_refresh on a registered session; keeping the adv secret');
            return;
        }
        creds.advSecretKey = randomBytes(32).toString('base64');
        ev.emit('creds.update', { advSecretKey: creds.advSecretKey });
        logger.info('rotated the adv secret the server asked to retire; re-rendering the pairing QR');
        refreshPairingQR?.();
    });
    // device paired for the first time`;

  content = replaceOnce(content, originalBlock, patchedBlock, "companion_reg_refresh");
  fs.writeFileSync(socketPath, content, "utf8");
}

function main() {
  if (!fs.existsSync(baileysRoot)) {
    console.warn("[patch-baileys] Baileys no esta instalado, se omite el parche.");
    return;
  }

  patchMessagesRecv();
  patchSocket();
  console.log("[patch-baileys] Parche aplicado correctamente.");
}

main();
