import puppeteer from 'puppeteer-core';
import { createWorker } from 'tesseract.js';
import fs from 'fs';
import path from 'path';
import { db, CERTS_DIR } from './dist/database/db.js';
import { decryptText } from './dist/utils/crypto.js';
import forge from 'node-forge';

async function autoLinkCert() {
  console.log('🤖 [Robô Salvador] Iniciando automação de login e vínculo de Certificado Digital...');

  const comp = db.prepare("SELECT * FROM companies WHERE cnpj = '11156091000175'").get();
  if (!comp || !comp.nfse_senha_prefeitura) {
    throw new Error('Empresa ou Senha da Prefeitura não configurada.');
  }

  let passDecrypted = '';
  try {
    passDecrypted = decryptText(comp.nfse_senha_prefeitura);
  } catch (_) {
    passDecrypted = comp.nfse_senha_prefeitura;
  }

  // Extrai o .cer (chave pública) do Certificado A1
  const certPath = path.join(CERTS_DIR, comp.cert_filename);
  const certPass = decryptText(comp.cert_password_enc);
  const pfxBuffer = fs.readFileSync(certPath);
  const pfx = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(pfxBuffer.toString('binary')), certPass);

  let certPem = '';
  for (const sc of pfx.safeContents) {
    for (const sb of sc.safeBags) {
      if (sb.cert) {
        certPem += forge.pki.certificateToPem(sb.cert);
      }
    }
  }

  const cerFilePath = '/tmp/viacont_public_cert.cer';
  fs.writeFileSync(cerFilePath, certPem);
  console.log(`📄 Chave pública .cer exportada para: ${cerFilePath}`);

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser';
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    console.log('🌐 Acessando https://nfse.salvador.ba.gov.br/default.aspx ...');
    await page.goto('https://nfse.salvador.ba.gov.br/default.aspx', { waitUntil: 'networkidle2', timeout: 35000 });

    // Loop de Login
    let loggedIn = false;
    let attempts = 0;
    const worker = await createWorker('eng');
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    });

    while (!loggedIn && attempts < 8) {
      attempts++;
      console.log(`🔄 Tentativa de Login ${attempts}/8...`);

      const captchaEl = await page.$('#img1');
      if (!captchaEl) throw new Error('Elemento de Captcha não encontrado.');

      const captchaBuf = await captchaEl.screenshot();
      const { data: { text } } = await worker.recognize(captchaBuf);
      const solved = text.replace(/[^a-zA-Z0-9]/g, '').trim().substring(0, 5);

      console.log(`🔡 Captcha lido via OCR: "${solved}"`);

      await page.evaluate(() => {
        const u = document.querySelector('#txtLogin');
        const p = document.querySelector('#txtSenha');
        const c = document.querySelector('#tbCaptcha');
        if (u) u.value = '';
        if (p) p.value = '';
        if (c) c.value = '';
      });

      await page.type('#txtLogin', comp.cnpj.replace(/\D/g, ''), { delay: 30 });
      await page.type('#txtSenha', passDecrypted, { delay: 30 });
      await page.type('#tbCaptcha', solved, { delay: 30 });

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => null),
        page.click('#cmdLogin')
      ]);

      const curUrl = page.url();
      console.log(`📍 URL atual: ${curUrl}`);

      if (!curUrl.includes('default.aspx')) {
        loggedIn = true;
        console.log('🎉 Login efetuado com sucesso no portal da Nota Salvador!');
      } else {
        const bodyText = await page.evaluate(() => document.body.innerText);
        if (bodyText.includes('Senha inválida') || bodyText.includes('Usuário não cadastrado')) {
          throw new Error('Usuário ou Senha incorretos no portal da Nota Salvador.');
        }
        await page.evaluate(() => {
          const btn = document.querySelector('a[onclick*="atualizarImg"]');
          if (btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    await worker.terminate();

    if (!loggedIn) {
      throw new Error('Falha ao autenticar no portal da Nota Salvador após múltiplas tentativas de OCR.');
    }

    // Navega pelo menu interno para localizar o vínculo de Certificado Digital
    console.log('🔍 Procurando menu de Certificado Digital / Configurações...');
    const menuLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.innerText.trim(),
        href: a.href,
        onclick: a.getAttribute('onclick')
      })).filter(a => a.text.length > 0);
    });

    console.log('📋 Links encontrados no portal:');
    menuLinks.forEach(l => {
      if (l.text.toLowerCase().includes('certific') || l.text.toLowerCase().includes('config') || l.text.toLowerCase().includes('perfil') || l.text.toLowerCase().includes('rps')) {
        console.log(`   👉 [${l.text}] -> ${l.href} (onclick: ${l.onclick})`);
      }
    });

    // Salva screenshot do painel logado
    const screenshotPath = '/tmp/painel_salvador_logado.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot salvo em: ${screenshotPath}`);

  } finally {
    await browser.close().catch(() => null);
  }
}

autoLinkCert().catch(e => {
  console.error('❌ Erro no Robô:', e.message);
});
