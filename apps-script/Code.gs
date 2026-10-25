/**
 * Envío de códigos de acceso del Portal CLAS Agregado La Querencia.
 * Se publica como "Aplicación web" desde la cuenta claslaquerencia@gmail.com (ver README).
 * El portal (Cloudflare Pages) llama a esta dirección con el código; el correo sale desde Gmail.
 */

// Debe ser idéntico a la variable MAIL_WEBHOOK_SECRET de Cloudflare Pages
const SECRET = 'PEGAR_AQUI_EL_MISMO_VALOR_DE_MAIL_WEBHOOK_SECRET';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (!SECRET || SECRET.indexOf('PEGAR_AQUI') === 0 || data.secret !== SECRET) return respond({ ok: false, error: 'auth' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.to) || !/^\d{6}$/.test(data.code)) return respond({ ok: false, error: 'datos' });

    const minutos = Number(data.minutos) || 10;
    MailApp.sendEmail({
      to: data.to,
      name: 'CLAS Agregado La Querencia',
      subject: data.code + ' es tu código de acceso al Portal de Documentos de Gestión',
      body:
        'Tu código de acceso al Portal de Documentos de Gestión del CLAS Agregado La Querencia es: ' + data.code + '\n\n' +
        'Vence en ' + minutos + ' minutos. No lo compartas con nadie.\n' +
        'Si no intentaste ingresar al portal, ignora este mensaje.',
      htmlBody:
        '<div style="font-family:Georgia,serif;max-width:480px;margin:auto;color:#2b2a28">' +
        '<h2 style="font-weight:600;color:#201f1d">CLAS Agregado La Querencia</h2>' +
        '<p>Tu código de acceso al <strong>Portal de Documentos de Gestión</strong> es:</p>' +
        '<p style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#201f1d;background:#f7f4ee;' +
        'border:1px solid #e6e0d2;border-radius:10px;padding:14px 0;text-align:center">' + data.code + '</p>' +
        '<p>Vence en ' + minutos + ' minutos. No lo compartas con nadie.</p>' +
        '<p style="font-size:12px;color:#6f685e">Si no intentaste ingresar al portal, ignora este mensaje.</p>' +
        '</div>',
    });
    return respond({ ok: true });
  } catch (err) {
    return respond({ ok: false, error: String(err) });
  }
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Ejecutar una vez desde el editor para autorizar el envío de correos y comprobar que llegan
function probarEnvio() {
  MailApp.sendEmail(Session.getActiveUser().getEmail(), 'Prueba del portal CLAS', 'El envío de códigos funciona.');
  Logger.log('Correos disponibles hoy: ' + MailApp.getRemainingDailyQuota());
}
