# SENA EXECUTIVA — Plataforma editorial full-stack

Aplicação funcional sem dependências npm externas, construída com Node.js 22.5+ (servidor HTTP nativo e `node:sqlite`), HTML/CSS/JavaScript. Reproduz o HTML editorial fornecido e acrescenta gestão de artigos, subscrições, contactos, utilizadores e configurações.

## Instalação e arranque

```bash
node --version        # versão >= 22.5
# opcional: exportar variáveis de .env.example (o Node não lê .env automaticamente)
ADMIN_EMAIL='admin@exemplo.ao' ADMIN_PASSWORD='uma-frase-forte-com-mais-de-12-caracteres' npm run init
npm start
```

Abrir `http://127.0.0.1:3000/` (site público) e `http://127.0.0.1:3000/admin` (painel). A base de dados SQLite é criada automaticamente em `data/sena.sqlite`; os 16 artigos de demonstração da referência são importados uma única vez. Para uma instalação editorial vazia, definir `SEED_DEMO=0` antes da primeira execução. **Atenção:** os conteúdos importados são demonstrações, não notícias validadas. Não publicar sem revisão editorial.

## Publicação

Configurar uma instância Node.js 22.5+ com armazenamento persistente para a base de dados; definir `NODE_ENV=production`, `HOST=127.0.0.1`, `PORT` e `DB_PATH` absoluto. Colocar Nginx/Caddy à frente com HTTPS, proxy reverso e cabeçalhos de segurança; activar cópias de segurança do ficheiro SQLite usando a API de backup do SQLite, não cópias inconsistentes a quente. Proteger os segredos de administração no gestor de segredos do servidor; não manter a palavra-passe na configuração após criar a conta. Usar um processo supervisionado (systemd/Docker com volume persistente) e monitorização. Para alta carga, migrar para PostgreSQL e introduzir um mecanismo dedicado de sessões e fila de correio.

## Funcionalidades

- Website editorial responsivo a partir da referência: pesquisa, categorias, destaques, leitor de artigos, tendências, modo escuro e favoritos locais.
- Artigos e estados de publicação guardados em SQLite, CRUD administrativo, auditoria e dashboard real.
- Subscrição de newsletter e formulário de contacto com persistência; consulta no painel; atualização de estado/observações.
- Login/logout com palavras-passe scrypt + salt aleatório, sessão httpOnly SameSite=Strict, token anti-CSRF, permissões `admin`/`editor`, contas desactiváveis e limite de tentativas por IP e conta, para que um utilizador não bloqueie os restantes atrás do mesmo router/proxy.
- Configurações institucionais reflectidas nos contactos do site. Os editores podem editar artigos e configurações; só administradores podem gerir utilizadores.

## APIs

Públicas: `GET /health`, `GET /api/public/articles`, `GET /api/public/settings`, `POST /api/newsletter` `{email}`, `POST /api/contact` `{name,email,subject,message}`.

Sessão: `POST /api/auth/login` `{email,password}`, `GET /api/auth/me`, `POST /api/auth/logout`.

Autenticadas: `GET /api/admin/dashboard`, `GET/POST /api/admin/articles`, `PUT/DELETE /api/admin/articles/:id`, `GET /api/admin/contacts`, `PATCH /api/admin/contacts/:id`, `GET /api/admin/subscribers`, `GET/PUT /api/admin/settings`. Só administrador: `GET/POST /api/admin/users`, `PATCH /api/admin/users/:id`.

Pedidos mutáveis autenticados requerem `X-CSRF-Token` obtido de `/api/auth/me` e cookie de sessão. Respostas JSON com códigos HTTP apropriados.

## Testes

```bash
npm test
```

## Limitações conhecidas / trabalho necessário antes do lançamento comercial

- A referência não inclui imagens/logótipo oficial como ficheiro; o logótipo tipográfico e a arte geométrica da origem foram preservados.
- Newsletter guarda inscrições, **não envia e-mail automaticamente**; integrar fornecedor transaccional e mecanismo de double opt-in/cancelamento.
- O envio real das respostas de contacto também necessita de fornecedor de correio.
- Não existe recuperação de palavra-passe por e-mail; o administrador deverá criar outra conta/autorização através de procedimento operacional. Não divulgar credenciais via chat.
- Não há upload de ficheiros no painel (a imagem/arte segue a referência); um serviço de armazenamento seguro exige implementação adicional.
- Favoritos e tema visual são estados locais de conveniência e não contas de utilizador.
- Conteúdos institucionais de serviços, soluções, políticas e termos são textos iniciais e requerem aprovação jurídica/editorial.
- As notícias/artigos importados são os exemplos do HTML original. Auditoria, contagens e contactos são reais, não valores simulados.
- Recomenda-se revisão externa de segurança, acessibilidade WCAG, carga, tratamento de consentimento de dados e backups antes de produção.
