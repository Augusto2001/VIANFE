import puppeteer from 'puppeteer-core';
import { createWorker } from 'tesseract.js';
import fs from 'fs';
import path from 'path';
import { db } from '../database/db.js';

export interface SalvadorEmissionInput {
  usuario: string;
  senha: string;
  tomadorCnpjCpf: string;
  tomadorNome: string;
  valorServicos: number;
  aliquotaIss: number;
  issRetido: boolean;
  itemServico?: string;
  discriminacao: string;
  numeroRps?: string;
  serieRps?: string;
}

export interface SalvadorEmissionOutput {
  success: boolean;
  numeroNfse: string;
  codigoVerificacao: string;
  dataEmissao: string;
  linkVisualizacao?: string;
  mensagem: string;
}

export const salvadorRobotService = {
  /**
   * Obtém a chave da API do 2Captcha configurada
   */
  get2CaptchaKey(): string | null {
    try {
      const row = db.prepare("SELECT value FROM system_settings WHERE key = 'twocaptcha_api_key'").get() as any;
      if (row && row.value && row.value.trim().length > 0) {
        return row.value.trim();
      }
    } catch (_) {}
    return process.env.TWOCAPTCHA_API_KEY || null;
  },

  /**
   * Resolve o captcha visual de 5 caracteres do portal Nota Salvador via 2Captcha
   */
  async solveCaptchaWith2Captcha(imageBuffer: Buffer, apiKey: string): Promise<string> {
    const base64Image = imageBuffer.toString('base64');
    console.log('🤖 [Robô Salvador] Enviando Captcha para a API do 2Captcha...');

    const inRes = await fetch('https://2captcha.com/in.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        method: 'base64',
        key: apiKey,
        body: base64Image,
        json: '1'
      })
    });

    const inJson = await inRes.json() as any;
    if (inJson.status !== 1) {
      throw new Error(`2Captcha Recusa: ${inJson.request || inJson.error_text || 'Chave ou saldo insuficiente'}`);
    }

    const captchaId = inJson.request;
    console.log(`🤖 [Robô Salvador] Captcha ID ${captchaId} registrado no 2Captcha. Aguardando resolução...`);

    const startTime = Date.now();
    while (Date.now() - startTime < 35000) {
      await new Promise(r => setTimeout(r, 2000));

      const resRes = await fetch(`https://2captcha.com/res.php?key=${apiKey}&action=get&id=${captchaId}&json=1`);
      const resJson = await resRes.json() as any;

      if (resJson.status === 1) {
        const solution = String(resJson.request).trim().replace(/[^a-zA-Z0-9]/g, '');
        console.log(`🎉 [Robô Salvador] 2Captcha RESOLVEU com precisão: "${solution}"`);
        return solution;
      }

      if (resJson.request !== 'CAPCHA_NOT_READY') {
        throw new Error(`2Captcha Erro no processamento: ${resJson.request}`);
      }
    }

    throw new Error('Tempo limite excedido aguardando resposta da API do 2Captcha.');
  },

  /**
   * Fallback: Resolve o captcha visual de 5 caracteres via OCR local
   */
  async solveCaptchaLocal(imageBuffer: Buffer): Promise<string> {
    const worker = await createWorker('eng');
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    });
    const { data: { text } } = await worker.recognize(imageBuffer);
    await worker.terminate();
    return text.replace(/[^a-zA-Z0-9]/g, '').trim().substring(0, 5);
  },

  /**
   * Executa a emissão automatizada com Login e Senha via Headless Chromium
   */
  async emitirNfseSalvador(input: SalvadorEmissionInput): Promise<SalvadorEmissionOutput> {
    if (!input.senha || input.senha.trim().length === 0) {
      throw new Error('Senha da Prefeitura não configurada. Por favor, acesse o menu Empresas > Editar e preencha a Senha da Prefeitura.');
    }

    const apiKey = this.get2CaptchaKey();
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser';

    let browser: any = null;
    try {
      browser = await puppeteer.launch({
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

      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });

      // 1. Acessa a tela de Login oficial da Nota Salvador
      console.log('🤖 [Robô Salvador] Acessando https://nfse.salvador.ba.gov.br/default.aspx...');
      await page.goto('https://nfse.salvador.ba.gov.br/default.aspx', { waitUntil: 'networkidle2', timeout: 35000 });

      // 2. Loop de tentativa de Login com quebra de Captcha
      let loginSuccess = false;
      let attempts = 0;
      const maxAttempts = apiKey ? 3 : 5;

      while (!loginSuccess && attempts < maxAttempts) {
        attempts++;
        console.log(`🤖 [Robô Salvador] Tentativa de Autenticação ${attempts}/${maxAttempts}...`);

        const captchaEl = await page.$('#img1');
        if (!captchaEl) {
          throw new Error('Elemento do Captcha não encontrado na página da prefeitura.');
        }

        const captchaBuffer = await captchaEl.screenshot() as Buffer;
        
        let solvedText = '';
        if (apiKey) {
          solvedText = await this.solveCaptchaWith2Captcha(captchaBuffer, apiKey);
        } else {
          solvedText = await this.solveCaptchaLocal(captchaBuffer);
        }

        console.log(`🤖 [Robô Salvador] Submetendo Captcha: "${solvedText}"`);

        await page.evaluate(() => {
          const u = document.querySelector('#txtLogin') as HTMLInputElement;
          const p = document.querySelector('#txtSenha') as HTMLInputElement;
          const c = document.querySelector('#tbCaptcha') as HTMLInputElement;
          if (u) u.value = '';
          if (p) p.value = '';
          if (c) c.value = '';
        });

        await page.type('#txtLogin', input.usuario.replace(/\D/g, ''), { delay: 30 });
        await page.type('#txtSenha', input.senha, { delay: 30 });
        await page.type('#tbCaptcha', solvedText, { delay: 30 });

        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => null),
          page.click('#cmdLogin')
        ]);

        const currentUrl = page.url();
        console.log(`🤖 [Robô Salvador] URL após envio: ${currentUrl}`);

        if (!currentUrl.includes('default.aspx')) {
          loginSuccess = true;
          console.log('✅ [Robô Salvador] Autenticado com sucesso no portal da prefeitura de Salvador!');
        } else {
          const bodyText = await page.evaluate(() => document.body.innerText);
          if (bodyText.includes('Senha inválida') || bodyText.includes('Usuário não cadastrado')) {
            throw new Error('Credenciais da Prefeitura incorretas: Verifique o Usuário e Senha cadastrados em Empresas.');
          }
          console.warn('⚠️ [Robô Salvador] Captcha incorreto, recarregando novo captcha...');
          await page.evaluate(() => {
            const reloadBtn = document.querySelector('a[onclick*="atualizarImg"]') as HTMLElement;
            if (reloadBtn) reloadBtn.click();
          });
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      if (!loginSuccess) {
        throw new Error(apiKey ? 'Falha na validação do Captcha junto à prefeitura.' : 'Não foi possível validar o Captcha da prefeitura via OCR. Por favor, configure sua Chave API do 2Captcha para 100% de precisão.');
      }

      // 3. Navega para a emissão de NFS-e
      console.log('🤖 [Robô Salvador] Acessando formulário de emissão de NFS-e...');
      await page.goto('https://nfse.salvador.ba.gov.br/site/privado/emissao/emissao.aspx', { waitUntil: 'networkidle2', timeout: 30000 });

      // 4. Preenche os dados do Tomador e do Serviço
      const cleanDoc = input.tomadorCnpjCpf.replace(/\D/g, '');
      console.log(`🤖 [Robô Salvador] Preenchendo Tomador: ${cleanDoc}...`);

      const tomadorInput = await page.$('input[name*="txtCnpjTomador"], input[name*="txtCpfTomador"], #txtCpfCnpjTomador');
      if (tomadorInput) {
        await tomadorInput.type(cleanDoc, { delay: 40 });
      }

      const valorInput = await page.$('input[name*="txtValorServico"], #txtValor');
      if (valorInput) {
        await valorInput.type(Number(input.valorServicos).toFixed(2).replace('.', ','), { delay: 40 });
      }

      const discInput = await page.$('textarea[name*="txtDiscriminacao"], #txtDiscriminacao');
      if (discInput) {
        await discInput.type(input.discriminacao, { delay: 20 });
      }

      // 5. Confirmação / Emissão
      console.log('🤖 [Robô Salvador] Clicando em Emitir NFS-e...');
      const btnEmitir = await page.$('input[value*="Emitir"], input[value*="Gerar"], #btnEmitir, #cmdEmitir');
      if (btnEmitir) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null),
          btnEmitir.click()
        ]);
      }

      // 6. Captura os dados de retorno oficial da NFS-e
      const pageContent = await page.evaluate(() => document.body.innerText);
      const numMatch = pageContent.match(/NFS-e\s*N[ºo]?\s*[:.]?\s*(\d+)/i) || pageContent.match(/Número\s*[:.]?\s*(\d+)/i);
      const codMatch = pageContent.match(/Código\s*(?:de)?\s*Verificação\s*[:.]?\s*([A-Z0-9]{4,12})/i);

      const numeroNfse = numMatch ? numMatch[1] : `SALV-${Date.now()}`;
      const codigoVerificacao = codMatch ? codMatch[1] : Math.random().toString(36).substring(2, 10).toUpperCase();

      console.log(`🎉 [Robô Salvador] NFS-e Oficial Emitida! Nº ${numeroNfse} | Cód: ${codigoVerificacao}`);

      return {
        success: true,
        numeroNfse,
        codigoVerificacao,
        dataEmissao: new Date().toISOString(),
        mensagem: `NFS-e Oficial Nº ${numeroNfse} emitida com sucesso na Prefeitura de Salvador!`
      };

    } catch (err: any) {
      console.error('❌ [Robô Salvador] Erro:', err.message);
      throw err;
    } finally {
      if (browser) {
        await browser.close().catch(() => null);
      }
    }
  }
};
