# Nova Vida - Enriquecimento

Aplicação MVP para validar planilhas, detectar o tipo de enriquecimento, permitir escolha dos campos a importar, montar uma fila de solicitação e acompanhar a conclusão da importação pela equipe de estratégia.

## Como rodar

1. Crie e ative um ambiente virtual (opcional, mas recomendado).
2. Instale as dependências:
   pip install -r requirements.txt
3. Inicie a aplicação:
   python app.py
4. Acesse http://localhost:5000/login

## Usuários de teste

- Admin Estratégia: username=admin, password=admin123
- Usuário SAF: username=saf, password=saf123

## Fluxo principal

- Usuário 1 envia uma planilha em Excel/CSV.
- O backend identifica o tipo de enriquecimento com base no nome das colunas.
- O sistema valida o arquivo e simula o enriquecimento.
- O usuário escolhe os campos a importar por drag-and-drop.
- A solicitação é enviada para fila com número de fila, nome do solicitante e observações.
- A equipe de estratégia visualiza a fila, faz o download da exportação e conclui a importação anexando o resumo.
- A notificação retorna ao usuário 1 como confirmação.

## Integração com a API da Nova Vida

O backend agora tenta chamar a API da Nova Vida quando as variáveis de ambiente estiverem configuradas:

- `NOVA_VIDA_API_URL` — URL base da API, por exemplo `https://api.novavida.com.br`
- `NOVA_VIDA_API_ENDPOINT` — endpoint do enriquecimento, por exemplo `/api/enrichment`
- `NOVA_VIDA_API_KEY` ou `NOVA_VIDA_TOKEN` — token de autenticação

Exemplo:

```bash
set NOVA_VIDA_API_URL=https://api.novavida.com.br
set NOVA_VIDA_API_ENDPOINT=/api/enrichment
set NOVA_VIDA_API_KEY=sua-chave
python app.py
```

Se a API não estiver configurada ou responder com erro, o sistema mantém o comportamento de fallback em mock para não quebrar o fluxo de teste local.

## Observações

- A integração com a API da Nova Vida foi preparada em código para uso real, com fallback seguro para ambiente local.
- Os dados são mantidos em memória durante a execução da aplicação.
