const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.normalize('C:/Users/USER/Documents/ChatGPT/SALES - DEMONSTRAÇÕES CONTABEIS/vianfe-github-current/server/storage/data/fiscal_hub.db');
const db = new DatabaseSync(dbPath);

console.log('--- ATUALIZANDO CADASTRO DE EMPRESAS DE SERVIÇO ---');

const updates = [
  {
    cnpj: '11156091000175',
    razao: 'VIACONT INOVACOES CONTABEIS LTDA',
    im: '72516200143',
    pref: 'Salvador',
    emite: 1,
    cnae: '6920601',
    item: '17.01',
    codigo_trib: '692060101',
    aliq: 5.0
  },
  {
    cnpj: '35541790000105',
    razao: 'TREND TELECOM SERVICOS ELETRICOS E ELETRONICOS LTDA',
    im: '71905200102',
    pref: 'Salvador',
    emite: 1,
    cnae: '4321500',
    item: '14.01',
    codigo_trib: '432150001',
    aliq: 5.0
  },
  {
    cnpj: '03599819000105',
    razao: 'CANDA E FRANCA LTDA',
    im: '16460800184',
    pref: 'Salvador',
    emite: 1,
    cnae: '8592901',
    item: '08.02',
    codigo_trib: '859290101',
    aliq: 2.0
  },
  {
    cnpj: '20381369000107',
    razao: 'J N SANTOS / JOAO NASCIMENTO SANTOS',
    im: '49449200184',
    pref: 'Salvador',
    emite: 1,
    cnae: '9313100',
    item: '12.01',
    codigo_trib: '931310001',
    aliq: 2.0
  },
  {
    cnpj: '63200839000193',
    razao: 'COPARTNERS CONSULTORIA EMPRESARIAL',
    im: '104608700167',
    pref: 'Salvador',
    emite: 1,
    cnae: '7020400',
    item: '17.01',
    codigo_trib: '702040001',
    aliq: 5.0
  },
  {
    cnpj: '49216709000118',
    razao: 'AG7CONSULTORIA EDUCACAO E MARKETING LTDA',
    im: '080210693119',
    pref: 'Curitiba',
    emite: 1,
    cnae: '8599604',
    item: '08.02',
    codigo_trib: '859960401',
    aliq: 5.0
  },
  {
    cnpj: '39510955000124',
    razao: 'VE EMPREENDIMENTOS E CONSTRUCAO CIVIL LTDA',
    im: '3181601607',
    pref: 'São Gonçalo dos Campos',
    emite: 1,
    cnae: '4120400',
    item: '07.02',
    codigo_trib: '412040001',
    aliq: 5.0
  },
  {
    cnpj: '15740333000124',
    razao: 'ASL TRANSPORTE LTDA',
    im: '72381900139',
    pref: 'Portal Nacional ADN (nfse.gov.br)',
    emite: 1,
    cnae: '4930202',
    item: '16.01',
    codigo_trib: '493020201',
    aliq: 5.0
  }
];

const updateStmt = db.prepare(`
  UPDATE companies SET
    inscricao_municipal = ?,
    nfse_prefeitura_padrao = ?,
    emite_nfse = ?,
    cnae_padrao = COALESCE(?, cnae_padrao),
    item_servico_padrao = COALESCE(?, item_servico_padrao),
    codigo_tributacao_municipio = COALESCE(?, codigo_tributacao_municipio),
    nfse_aliquota_padrao = COALESCE(?, nfse_aliquota_padrao)
  WHERE cnpj LIKE ?
`);

for (const u of updates) {
  const res = updateStmt.run(
    u.im,
    u.pref,
    u.emite,
    u.cnae,
    u.item,
    u.codigo_trib,
    u.aliq,
    `%${u.cnpj}%`
  );
  console.log(`✅ ${u.razao} (${u.cnpj}) -> IM: ${u.im} | Pref: ${u.pref} | Changes: ${res.changes}`);
}
