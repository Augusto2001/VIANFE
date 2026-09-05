# 🏦 Guia de Open Finance & Integração com Domínio Sistemas

## 1. Webhook Open Finance Plug & Play
Cada empresa cadastrada no ViaNfe possui uma URL de webhook única e protegida:

`
POST https://vianfe.contadordev.com.br/api/bpo/open-finance/webhook/:companyId
`

### Exemplo de Payload Suportado:
`json
{
  transactions: [
    {
      fitid: TRN-9847291-INTER,
      data: 2026-09-04,
      tipo: DEBITO,
      valor: 1250.00,
      descricao: PAGTO FORNECEDOR JBS SA,
      documento: DOC-84910
    }
  ]
}
`

---

## 2. Exportação para a Domínio Sistemas
1. Acesse o menu **Financeiro > BPO & Conciliação**.
2. Clique no botão **Auto-Mapear Domínio** para associar automaticamente as categorias ao plano de contas contábil.
3. Clique em **Exportar Domínio (.TXT)**.
4. O arquivo gerado segue o layout padrão de importação de lançamentos contábeis da Domínio Sistemas.
