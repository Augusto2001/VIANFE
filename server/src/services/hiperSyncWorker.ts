import fs from 'fs';
import path from 'path';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import { integrationVaultService } from './integrationVaultService.js';
import { db } from '../database/db.js';

function getChromeExecutablePath(): string {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }
  // Linux container
  if (fs.existsSync('/usr/bin/chromium')) {
    return '/usr/bin/chromium';
  }
  if (fs.existsSync('/usr/bin/google-chrome')) {
    return '/usr/bin/google-chrome';
  }
  // Windows host
  const winChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (fs.existsSync(winChrome)) {
    return winChrome;
  }
  const winChromeX86 = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
  if (fs.existsSync(winChromeX86)) {
    return winChromeX86;
  }
  throw new Error('Navegador Chromium / Chrome não encontrado para o robô headless.');
}

export interface HiperStore {
  name: string;
  cnpj: string;
  uuid: string;
}

export const ACTIVE_HIPER_STORES: HiperStore[] = [
  { name: 'CHURRASCARIA TRADICAO GAUCHA', cnpj: '51.090.446/0001-95', uuid: 'a5b4e169-fc68-41ec-8490-820c9f15dc01' },
  { name: 'BIAPELL PRESENTES', cnpj: '43.855.131/0001-63', uuid: '17834d4e-1f32-4c2d-a8bf-8b71fe5c295b' },
  { name: 'LOPES SALES MOVEIS', cnpj: '14.317.503/0001-08', uuid: 'dcddc65b-2e6d-457f-9712-b26427a0cbd9' },
  { name: 'MI REGALO COMERCIO', cnpj: '48.292.424/0001-01', uuid: '9512e3cc-5cd6-4901-b5b3-50fa9e3c4010' },
  { name: 'DEPOSITO NOVO HORIZONTE', cnpj: '33.281.238/0001-91', uuid: 'e7d7a887-39c7-4577-861f-e414074fcf5e' },
  { name: 'CS MARMORES E GRANITOS', cnpj: '48.987.894/0001-81', uuid: 'e20393d2-a64a-4cea-81df-fc44f5ed6305' },
  { name: 'LEANDRO GOMES NOGUEIRA', cnpj: '73.472.235/0001-50', uuid: '694f7642-03c5-4c03-8922-383afbfdfd88' },
  { name: 'TREND TELECOM', cnpj: '35.541.790/0001-05', uuid: 'd42d133e-e87f-49b4-a2a1-b62d880f0538' }
];

export interface HiperTriggerResult {
  store: string;
  cnpj: string;
  status: 'SOLICITADO_COM_SUCESSO' | 'SEM_MOVIMENTO' | 'ERRO';
  detail: string;
}

export class HiperSyncWorker {
  private portalUrl = 'https://contador.hiper.com.br';

  private getCredentials(): { user: string; pass: string } {
    const cred = integrationVaultService.getCredential('hiper');
    if (cred && cred.username && cred.password) {
      return { user: cred.username, pass: cred.password };
    }
    const envUser = process.env.HIPER_USER || 'atendimento@viacont.com.br';
    const envPass = process.env.HIPER_PASSWORD || 'Cont123@';
    return { user: envUser, pass: envPass };
  }

  /**
   * Testa a autenticação do robô no portal Hiper Contador
   */
  public async testAuthentication(): Promise<{ success: boolean; message: string; clientsCount?: number }> {
    const { user, pass } = this.getCredentials();
    let browser: Browser | null = null;
    try {
      const execPath = getChromeExecutablePath();
      browser = await puppeteer.launch({
        executablePath: execPath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote'
        ]
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });
      await page.goto(this.portalUrl, { waitUntil: 'networkidle2', timeout: 35000 });
      await new Promise(r => setTimeout(r, 2000));

      await page.type('input[name="usuario"]', user, { delay: 15 });
      await page.type('input[name="senha"]', pass, { delay: 15 });
      await page.click('button.btn');

      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 25000 }).catch(() => null);
      await new Promise(r => setTimeout(r, 3000));

      const currentUrl = page.url();
      if (currentUrl.includes('/login') || (await page.$('.error, .alert-danger, [role="alert"]'))) {
        const errorText = await page.evaluate(() => {
          const el = document.querySelector('.error, .alert-danger, [role="alert"]');
          return el ? el.textContent?.trim() : 'Falha na autenticação';
        });
        return { success: false, message: `Erro ao logar no Hiper: ${errorText}` };
      }

      return { success: true, message: 'Login no Hiper Contador autenticado com sucesso!' };
    } catch (err: any) {
      return { success: false, message: `Exceção durante conexão com Hiper: ${err.message}` };
    } finally {
      if (browser) await browser.close();
    }
  }

  /**
   * Executa a esteira oficial de solicitação de geração de XMLs de vendas
   * para todas as lojas ativas no Hiper Contador para a competência desejada.
   */
  public async triggerMonthlyXmlGeneration(
    ano?: number,
    mes?: number,
    destinationEmail: string = 'atendimento@viacont.com.br'
  ): Promise<HiperTriggerResult[]> {
    const now = new Date();
    // Padrão: competência anterior
    let targetAno = ano || now.getFullYear();
    let targetMes = mes !== undefined ? mes : now.getMonth(); // 0 = janeiro -> anterior
    if (targetMes === 0) {
      targetMes = 12;
      targetAno -= 1;
    }

    console.log(`🤖 [ROBÔ HIPER] Iniciando solicitação de XMLs de vendas: Competência ${String(targetMes).padStart(2, '0')}/${targetAno} para ${destinationEmail}...`);

    const { user, pass } = this.getCredentials();
    const execPath = getChromeExecutablePath();
    const results: HiperTriggerResult[] = [];

    let browser: Browser | null = null;
    try {
      browser = await puppeteer.launch({
        executablePath: execPath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote'
        ]
      });

      const masterPage = await browser.newPage();
      await masterPage.setViewport({ width: 1440, height: 900 });

      console.log(`🔑 [ROBÔ HIPER] Autenticando no portal Hiper Contador...`);
      await masterPage.goto(this.portalUrl, { waitUntil: 'networkidle2', timeout: 35000 });
      await new Promise(r => setTimeout(r, 2000));

      await masterPage.type('input[name="usuario"]', user, { delay: 10 });
      await masterPage.type('input[name="senha"]', pass, { delay: 10 });
      await masterPage.click('button.btn');

      await masterPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 25000 }).catch(() => null);
      await new Promise(r => setTimeout(r, 3000));

      for (const store of ACTIVE_HIPER_STORES) {
        console.log(`🏪 [ROBÔ HIPER] Processando loja: ${store.name} (${store.cnpj})...`);
        const storePage = await browser.newPage();
        await storePage.setViewport({ width: 1440, height: 900 });

        try {
          await storePage.goto(`https://contador.hiper.com.br/acessar-gestao/${store.uuid}`, { waitUntil: 'networkidle2', timeout: 40000 });
          await new Promise(r => setTimeout(r, 4000));

          await storePage.goto('https://app.hiper.com.br/contabilidade/download-de-xml/gerar', { waitUntil: 'networkidle2', timeout: 35000 });
          await new Promise(r => setTimeout(r, 3000));

          await storePage.select('#AnoParaGeracao', String(targetAno));
          await storePage.select('#MesParaGeracao', String(targetMes));

          await storePage.focus('input[name="Email"]');
          await storePage.keyboard.down('Control');
          await storePage.keyboard.press('A');
          await storePage.keyboard.up('Control');
          await storePage.keyboard.press('Backspace');
          await storePage.type('input[name="Email"]', destinationEmail, { delay: 15 });

          await Promise.all([
            storePage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 25000 }).catch(() => null),
            storePage.click('form[action="/contabilidade/download-de-xml/gerar"] button[type="submit"]')
          ]);

          await new Promise(r => setTimeout(r, 3000));

          const bodyText = await storePage.evaluate(() => document.body.innerText);

          let status: 'SOLICITADO_COM_SUCESSO' | 'SEM_MOVIMENTO' | 'ERRO' = 'ERRO';
          let detail = '';

          if (bodyText.includes('No período informado não foi encontrado nenhum documento fiscal')) {
            status = 'SEM_MOVIMENTO';
            detail = `Nenhum documento fiscal emitido na competência ${String(targetMes).padStart(2, '0')}/${targetAno}.`;
            console.log(`   ℹ️ [ROBÔ HIPER] ${store.name}: Sem movimento fiscal nesta competência.`);
          } else if (bodyText.includes('sucesso') || bodyText.includes('solicitação') || bodyText.includes('enviad') || bodyText.includes('Download de XML')) {
            status = 'SOLICITADO_COM_SUCESSO';
            detail = `Pacote ZIP de XMLs solicitado com sucesso e encaminhado para ${destinationEmail}.`;
            console.log(`   🎉 [ROBÔ HIPER] ${store.name}: Solicitação efetuada com sucesso!`);
          } else {
            detail = bodyText.substring(0, 150).replace(/\n/g, ' ');
            console.log(`   ⚠️ [ROBÔ HIPER] ${store.name}: Resposta: ${detail}`);
          }

          results.push({ store: store.name, cnpj: store.cnpj, status, detail });
        } catch (storeErr: any) {
          console.error(`   ❌ [ROBÔ HIPER] Erro na loja ${store.name}:`, storeErr.message);
          results.push({ store: store.name, cnpj: store.cnpj, status: 'ERRO', detail: storeErr.message });
        } finally {
          await storePage.close().catch(() => null);
        }

        await new Promise(r => setTimeout(r, 2000));
      }

      console.log(`🏁 [ROBÔ HIPER] Fechamento finalizado! ${results.filter(r => r.status === 'SOLICITADO_COM_SUCESSO').length} pacotes solicitados.`);
      return results;
    } catch (err: any) {
      console.error(`❌ [ROBÔ HIPER] Erro crítico no robô Hiper:`, err.message);
      return results;
    } finally {
      if (browser) await browser.close();
    }
  }
}

export const hiperSyncWorker = new HiperSyncWorker();
